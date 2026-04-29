import { NextRequest, NextResponse } from "next/server";
import { db, videos, videoChunks } from "@/lib/db";
import { eq, asc } from "drizzle-orm";
import { twelveLabsClient } from "@/lib/twelvelabs/client";
import { z } from "zod";
import { createId } from "@paralleldrive/cuid2";

const qaSchema = z.object({ question: z.string().min(1).max(1000) });

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = qaSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const [video] = await db.select().from(videos).where(eq(videos.id, id));
    if (!video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }
    if (video.status !== "ready" || !video.twelveLabsIndexId) {
      return NextResponse.json(
        { error: "Video is not ready for Q&A" },
        { status: 400 }
      );
    }

    const chunkRows = await db
      .select()
      .from(videoChunks)
      .where(eq(videoChunks.videoId, id))
      .orderBy(asc(videoChunks.chunkIndex));

    const readyChunks = chunkRows.filter(
      (c): c is typeof c & { twelveLabsVideoId: string } =>
        c.status === "ready" && Boolean(c.twelveLabsVideoId)
    );
    if (readyChunks.length === 0) {
      return NextResponse.json({ error: "No ready chunks" }, { status: 400 });
    }

    const { question } = parsed.data;

    // Search across ALL chunks of this lecture to find the most relevant segments
    const searchResult = await twelveLabsClient.semanticSearch(
      video.twelveLabsIndexId,
      question,
      {
        videoIds: readyChunks.map((c) => c.twelveLabsVideoId),
        pageLimit: 5,
      }
    );

    // Pick the chunk that contains the top-ranked search hit, or fall back to chunk 0
    const topHit = searchResult.data[0];
    const targetChunk =
      readyChunks.find((c) => c.twelveLabsVideoId === topHit?.video_id) ??
      readyChunks[0];

    // Ask Pegasus on the target chunk
    const qaResult = await twelveLabsClient.askQuestion(
      targetChunk.twelveLabsVideoId,
      question
    );

    // Build relevant segment list with global timestamps (chunk offset + local)
    const chunkByTl = new Map(
      readyChunks.map((c) => [c.twelveLabsVideoId, c.startOffsetSec])
    );

    const relevantSegments = searchResult.data.slice(0, 3).map((clip) => {
      const offset = chunkByTl.get(clip.video_id) ?? 0;
      return {
        start: offset + clip.start,
        end: offset + clip.end,
        text: clip.metadata.find((m) => m.type === "conversation")?.text ?? "",
        score: clip.score,
      };
    });

    return NextResponse.json({
      data: {
        id: createId(),
        role: "assistant",
        content: qaResult.answer,
        timestamps: relevantSegments.map((s) => s.start),
        segments: relevantSegments,
        createdAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("[POST /api/videos/[id]/qa]", error);
    return NextResponse.json({ error: "Failed to answer question" }, { status: 500 });
  }
}
