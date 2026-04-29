import { NextRequest, NextResponse } from "next/server";
import { db, videos, videoChunks, chapters, videoSummaries } from "@/lib/db";
import { eq, asc } from "drizzle-orm";
import { twelveLabsClient } from "@/lib/twelvelabs/client";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const [video] = await db.select().from(videos).where(eq(videos.id, id));
    if (!video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    // Already finalized — nothing to poll
    if (video.status === "ready" || video.status === "failed") {
      return NextResponse.json({ data: { status: video.status } });
    }

    // Find all chunks for this video
    const chunkRows = await db
      .select()
      .from(videoChunks)
      .where(eq(videoChunks.videoId, id))
      .orderBy(asc(videoChunks.chunkIndex));

    if (chunkRows.length === 0) {
      // No chunks yet — upload still in flight
      return NextResponse.json({ data: { status: video.status } });
    }

    // Poll each chunk's task that's still indexing
    let updatedAny = false;
    for (const chunk of chunkRows) {
      if (chunk.status === "ready" || chunk.status === "failed") continue;
      if (!chunk.twelveLabsTaskId) continue;

      const tasks = await twelveLabsClient.getTaskStatus(chunk.twelveLabsTaskId);
      if (tasks.status === "ready" && tasks.videoId) {
        await db
          .update(videoChunks)
          .set({ status: "ready", twelveLabsVideoId: tasks.videoId })
          .where(eq(videoChunks.id, chunk.id));
        updatedAny = true;
      } else if (tasks.status === "failed") {
        await db
          .update(videoChunks)
          .set({ status: "failed" })
          .where(eq(videoChunks.id, chunk.id));
        updatedAny = true;
      }
    }

    // Refetch chunks if anything changed
    const finalChunks = updatedAny
      ? await db
          .select()
          .from(videoChunks)
          .where(eq(videoChunks.videoId, id))
          .orderBy(asc(videoChunks.chunkIndex))
      : chunkRows;

    const ready = finalChunks.filter((c) => c.status === "ready").length;
    const failed = finalChunks.filter((c) => c.status === "failed").length;
    const total = finalChunks.length;

    // Roll up to parent status
    if (failed > 0) {
      await db
        .update(videos)
        .set({ status: "failed", updatedAt: new Date() })
        .where(eq(videos.id, id));
      return NextResponse.json({
        data: { status: "failed", chunks: { ready, failed, total } },
      });
    }

    if (ready === total) {
      // All chunks done — promote parent video, kick off content generation
      const firstChunk = finalChunks[0];

      // Pull metadata + thumbnail from first chunk
      let thumbnailUrl: string | null = null;
      try {
        if (firstChunk.twelveLabsVideoId && video.twelveLabsIndexId) {
          thumbnailUrl = await twelveLabsClient.getVideoThumbnail(
            video.twelveLabsIndexId,
            firstChunk.twelveLabsVideoId
          );
        }
      } catch { /* thumbnail is best-effort */ }

      await db
        .update(videos)
        .set({
          status: "ready",
          twelveLabsVideoId: firstChunk.twelveLabsVideoId,
          thumbnailUrl,
          updatedAt: new Date(),
        })
        .where(eq(videos.id, id));

      // Fire-and-forget AI generation across all chunks
      generateForAllChunks(id, finalChunks).catch(console.error);

      return NextResponse.json({
        data: { status: "ready", chunks: { ready, failed, total } },
      });
    }

    return NextResponse.json({
      data: { status: "indexing", chunks: { ready, failed, total } },
    });
  } catch (error) {
    console.error("[GET /api/videos/[id]/status]", error);
    return NextResponse.json({ error: "Failed to check status" }, { status: 500 });
  }
}

/**
 * Generate summary, chapters, and highlights across all chunks.
 * Runs Pegasus per chunk, then merges results with offset timestamps.
 */
async function generateForAllChunks(
  videoDbId: string,
  chunkRows: Array<{
    chunkIndex: number;
    startOffsetSec: number;
    twelveLabsVideoId: string | null;
  }>
) {
  try {
    const ready = chunkRows.filter(
      (c): c is typeof c & { twelveLabsVideoId: string } =>
        Boolean(c.twelveLabsVideoId)
    );
    if (ready.length === 0) return;

    // Per-chunk results
    const perChunk = await Promise.all(
      ready.map(async (c) => {
        try {
          const [summary, chapterList, highlights] = await Promise.all([
            twelveLabsClient.generateSummary(c.twelveLabsVideoId),
            twelveLabsClient.generateChapters(c.twelveLabsVideoId),
            twelveLabsClient.generateHighlights(c.twelveLabsVideoId),
          ]);
          return {
            chunk: c,
            summary: summary.summary,
            chapters: chapterList,
            highlights,
          };
        } catch (e) {
          console.error(
            `[generate] chunk ${c.chunkIndex} failed:`,
            (e as Error).message
          );
          return { chunk: c, summary: "", chapters: [], highlights: [] };
        }
      })
    );

    // Merge chapters with offset timestamps
    let orderIdx = 1;
    const mergedChapters = perChunk.flatMap((p) =>
      p.chapters.map((ch) => ({
        videoId: videoDbId,
        title: ch.chapter_title,
        startTime: p.chunk.startOffsetSec + ch.start,
        endTime: p.chunk.startOffsetSec + ch.end,
        summary: ch.chapter_summary,
        orderIndex: orderIdx++,
      }))
    );

    if (mergedChapters.length > 0) {
      await db.delete(chapters).where(eq(chapters.videoId, videoDbId));
      await db.insert(chapters).values(mergedChapters);
    }

    // Merge summary — for multi-chunk, label each part
    const mergedSummary =
      perChunk.length === 1
        ? perChunk[0].summary
        : perChunk
            .map((p, i) => `**Part ${i + 1}:** ${p.summary}`)
            .join("\n\n");

    // Merge highlights — flatten + dedupe + cap
    const mergedHighlights = Array.from(
      new Set(perChunk.flatMap((p) => p.highlights))
    ).slice(0, 8);

    await db.delete(videoSummaries).where(eq(videoSummaries.videoId, videoDbId));
    await db.insert(videoSummaries).values({
      videoId: videoDbId,
      fullSummary: mergedSummary,
      highlights: mergedHighlights,
    });
  } catch (err) {
    console.error("[generateForAllChunks]", err);
  }
}
