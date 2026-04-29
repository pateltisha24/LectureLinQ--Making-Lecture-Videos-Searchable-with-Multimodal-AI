import { NextRequest, NextResponse } from "next/server";
import { db, videoSummaries, videos, videoChunks } from "@/lib/db";
import { eq, asc } from "drizzle-orm";
import { twelveLabsClient } from "@/lib/twelvelabs/client";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const [summary] = await db
      .select()
      .from(videoSummaries)
      .where(eq(videoSummaries.videoId, id));
    return NextResponse.json({ data: summary ?? null });
  } catch (error) {
    console.error("[GET /api/videos/[id]/summary]", error);
    return NextResponse.json({ error: "Failed to fetch summary" }, { status: 500 });
  }
}

// Re-generate summary across all chunks
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

    const perChunk = await Promise.all(
      readyChunks.map(async (c) => {
        const [s, h] = await Promise.all([
          twelveLabsClient.generateSummary(c.twelveLabsVideoId),
          twelveLabsClient.generateHighlights(c.twelveLabsVideoId),
        ]);
        return { summary: s.summary, highlights: h };
      })
    );

    const mergedSummary =
      perChunk.length === 1
        ? perChunk[0].summary
        : perChunk
            .map((p, i) => `**Part ${i + 1}:** ${p.summary}`)
            .join("\n\n");

    const mergedHighlights = Array.from(
      new Set(perChunk.flatMap((p) => p.highlights))
    ).slice(0, 8);

    await db.delete(videoSummaries).where(eq(videoSummaries.videoId, id));
    const [saved] = await db
      .insert(videoSummaries)
      .values({
        videoId: id,
        fullSummary: mergedSummary,
        highlights: mergedHighlights,
      })
      .returning();

    return NextResponse.json({ data: saved });
  } catch (error) {
    console.error("[POST /api/videos/[id]/summary]", error);
    return NextResponse.json({ error: "Failed to generate summary" }, { status: 500 });
  }
}
