import { NextRequest, NextResponse } from "next/server";
import { db, chapters, videos, videoChunks } from "@/lib/db";
import { eq, asc } from "drizzle-orm";
import { twelveLabsClient } from "@/lib/twelvelabs/client";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const existingChapters = await db
      .select()
      .from(chapters)
      .where(eq(chapters.videoId, id))
      .orderBy(asc(chapters.orderIndex));
    return NextResponse.json({ data: existingChapters });
  } catch (error) {
    console.error("[GET /api/videos/[id]/chapters]", error);
    return NextResponse.json({ error: "Failed to fetch chapters" }, { status: 500 });
  }
}

// Re-generate chapters across all chunks
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const [video] = await db.select().from(videos).where(eq(videos.id, id));
    if (!video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }
    if (video.status !== "ready") {
      return NextResponse.json(
        { error: "Video is not ready for processing" },
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

    // Generate per chunk + offset timestamps
    const perChunk = await Promise.all(
      readyChunks.map(async (c) => ({
        offset: c.startOffsetSec,
        chapters: await twelveLabsClient.generateChapters(c.twelveLabsVideoId),
      }))
    );

    let orderIdx = 1;
    const merged = perChunk.flatMap((p) =>
      p.chapters.map((ch) => ({
        videoId: id,
        title: ch.chapter_title,
        startTime: p.offset + ch.start,
        endTime: p.offset + ch.end,
        summary: ch.chapter_summary,
        orderIndex: orderIdx++,
      }))
    );

    await db.delete(chapters).where(eq(chapters.videoId, id));
    const inserted =
      merged.length > 0
        ? await db.insert(chapters).values(merged).returning()
        : [];

    return NextResponse.json({ data: inserted });
  } catch (error) {
    console.error("[POST /api/videos/[id]/chapters]", error);
    return NextResponse.json(
      { error: "Failed to generate chapters" },
      { status: 500 }
    );
  }
}
