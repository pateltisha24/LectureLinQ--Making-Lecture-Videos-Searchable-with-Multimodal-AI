import { NextRequest, NextResponse } from "next/server";
import { db, videos, videoChunks } from "@/lib/db";
import { eq } from "drizzle-orm";
import { twelveLabsClient } from "@/lib/twelvelabs/client";
import {
  chunkVideo,
  cleanupChunks,
  probeDuration,
  writeUploadToTemp,
  CHUNK_THRESHOLD_SEC,
} from "@/lib/video/chunker";
import fs from "node:fs/promises";

const INDEX_NAME = "lecturelinq-index";

export const maxDuration = 600; // 10 min — chunking + sequential uploads can take a while
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let inputPath: string | null = null;
  let tempDir: string | null = null;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const title = formData.get("title") as string;
    const videoId = formData.get("videoId") as string;

    if (!file || !title || !videoId) {
      return NextResponse.json(
        { error: "Missing required fields: file, title, videoId" },
        { status: 400 }
      );
    }

    console.log(
      `[upload] received: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB)`
    );

    // 1. Save upload to temp file so ffmpeg can read it
    inputPath = await writeUploadToTemp(file);

    // 2. Probe duration
    const totalDuration = await probeDuration(inputPath);
    console.log(`[upload] duration: ${totalDuration.toFixed(1)}s`);

    // 3. Get / create index
    const index = await twelveLabsClient.getOrCreateIndex(INDEX_NAME);

    // 4. Chunk if needed
    const { chunks, tempDir: chunksTempDir } = await chunkVideo(
      inputPath,
      totalDuration
    );
    tempDir = chunksTempDir;

    if (chunks.length > 1) {
      console.log(
        `[upload] ⚙️  Splitting into ${chunks.length} chunks (video > ${CHUNK_THRESHOLD_SEC}s)`
      );
    }

    // 5. Upload chunks sequentially to Twelve Labs
    const taskIds: Array<{ chunk: typeof chunks[number]; taskId: string }> = [];
    for (const chunk of chunks) {
      console.log(
        `[upload] → chunk ${chunk.index + 1}/${chunks.length} (offset ${chunk.startOffsetSec}s)`
      );
      const buffer = await fs.readFile(chunk.filePath);
      const taskId = await twelveLabsClient.uploadVideoFile(
        index._id,
        buffer,
        `chunk-${chunk.index}.mp4`,
        chunks.length > 1 ? `${title} (Part ${chunk.index + 1}/${chunks.length})` : title
      );
      taskIds.push({ chunk, taskId });
      console.log(`[upload]   task: ${taskId}`);
    }

    // 6. Persist video + chunk rows
    await db
      .update(videos)
      .set({
        twelveLabsIndexId: index._id,
        twelveLabsVideoId: chunks.length === 1 ? `task:${taskIds[0].taskId}` : null,
        status: "indexing",
        duration: totalDuration,
        updatedAt: new Date(),
      })
      .where(eq(videos.id, videoId));

    // Wipe any leftover chunk rows for this video (e.g. retried upload)
    await db.delete(videoChunks).where(eq(videoChunks.videoId, videoId));

    await db.insert(videoChunks).values(
      taskIds.map(({ chunk, taskId }) => ({
        videoId,
        chunkIndex: chunk.index,
        startOffsetSec: chunk.startOffsetSec,
        durationSec: chunk.durationSec,
        twelveLabsTaskId: taskId,
        status: "indexing" as const,
      }))
    );

    return NextResponse.json({
      data: {
        id: videoId,
        chunks: chunks.length,
        durationSec: totalDuration,
      },
    });
  } catch (error: unknown) {
    const e = error as {
      response?: { status?: number; data?: { message?: string; code?: string } };
      message?: string;
      code?: string;
    };
    console.error("[POST /api/videos/upload]", {
      message: e.message,
      data: e.response?.data,
    });
    return NextResponse.json(
      {
        error: e.response?.data?.message ?? e.message ?? "Failed to upload video",
        code: e.response?.data?.code ?? e.code,
      },
      { status: 500 }
    );
  } finally {
    // Cleanup temp files
    if (inputPath) await fs.rm(inputPath, { force: true }).catch(() => undefined);
    await cleanupChunks(tempDir);
  }
}
