import { NextRequest, NextResponse } from "next/server";
import { db, videos, videoChunks } from "@/lib/db";
import { eq, inArray } from "drizzle-orm";
import { twelveLabsClient } from "@/lib/twelvelabs/client";
import { z } from "zod";

const searchSchema = z.object({
  query: z.string().min(1).max(500),
  videoIds: z.array(z.string()).optional(),
  pageLimit: z.number().min(1).max(50).optional().default(10),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = searchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const { query, videoIds, pageLimit } = parsed.data;

    // Fetch all ready videos
    const allVideos = await db
      .select({
        id: videos.id,
        twelveLabsIndexId: videos.twelveLabsIndexId,
        title: videos.title,
        thumbnailUrl: videos.thumbnailUrl,
      })
      .from(videos)
      .where(eq(videos.status, "ready"));

    if (allVideos.length === 0) {
      return NextResponse.json({ data: [] });
    }

    const indexId = allVideos[0].twelveLabsIndexId;
    if (!indexId) return NextResponse.json({ data: [] });

    // Pull every ready chunk for those videos so we can search across all parts
    const targetVideoIds = videoIds ?? allVideos.map((v) => v.id);
    if (targetVideoIds.length === 0) {
      return NextResponse.json({ data: [] });
    }

    const allChunks = await db
      .select()
      .from(videoChunks)
      .where(inArray(videoChunks.videoId, targetVideoIds));

    const readyChunks = allChunks.filter(
      (c) => c.status === "ready" && c.twelveLabsVideoId
    );
    if (readyChunks.length === 0) {
      return NextResponse.json({ data: [] });
    }

    // Maps for resolving chunk → parent video + offset
    const tlIdToChunk = new Map(
      readyChunks.map((c) => [c.twelveLabsVideoId!, c])
    );
    const videoMetaMap = new Map(
      allVideos.map((v) => [v.id, { id: v.id, title: v.title, thumbnailUrl: v.thumbnailUrl }])
    );

    const searchResult = await twelveLabsClient.semanticSearch(indexId, query, {
      videoIds: readyChunks.map((c) => c.twelveLabsVideoId!),
      pageLimit,
    });

    const results = searchResult.data.map((clip) => {
      const chunk = tlIdToChunk.get(clip.video_id);
      const offset = chunk?.startOffsetSec ?? 0;
      const parentVideoId = chunk?.videoId ?? clip.video_id;
      return {
        videoId: parentVideoId,
        video: videoMetaMap.get(parentVideoId),
        startTime: offset + clip.start,
        endTime: offset + clip.end,
        score: clip.score,
        text:
          clip.metadata.find((m) => m.type === "conversation")?.text ??
          clip.metadata.find((m) => m.type === "text_in_video")?.text ??
          "",
        confidence: clip.confidence,
        thumbnailUrl: clip.thumbnail_url,
      };
    });

    return NextResponse.json({ data: results });
  } catch (error) {
    console.error("[POST /api/search]", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
