import { NextRequest, NextResponse } from "next/server";
import { db, videos, videoChunks } from "@/lib/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
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

    return NextResponse.json({ data: video });
  } catch (error) {
    console.error("[GET /api/videos/[id]]", error);
    return NextResponse.json({ error: "Failed to fetch video" }, { status: 500 });
  }
}

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = updateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const [video] = await db
      .update(videos)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(videos.id, id))
      .returning();

    if (!video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    return NextResponse.json({ data: video });
  } catch (error) {
    console.error("[PATCH /api/videos/[id]]", error);
    return NextResponse.json({ error: "Failed to update video" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Look up the video first so we can also delete it from Twelve Labs
    const [video] = await db.select().from(videos).where(eq(videos.id, id));
    if (!video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    // Delete every chunk's video from Twelve Labs to free up quota
    if (video.twelveLabsIndexId) {
      const chunkRows = await db
        .select()
        .from(videoChunks)
        .where(eq(videoChunks.videoId, id));

      const tlVideoIds = new Set<string>();
      for (const c of chunkRows) {
        if (c.twelveLabsVideoId) tlVideoIds.add(c.twelveLabsVideoId);
      }
      // Legacy single-video records (pre-chunking)
      if (
        video.twelveLabsVideoId &&
        !video.twelveLabsVideoId.startsWith("task:")
      ) {
        tlVideoIds.add(video.twelveLabsVideoId);
      }

      for (const tlId of tlVideoIds) {
        try {
          await twelveLabsClient.deleteVideo(video.twelveLabsIndexId, tlId);
        } catch (e) {
          console.warn(`[DELETE] Twelve Labs delete ${tlId} failed:`, e);
        }
      }
    }

    await db.delete(videos).where(eq(videos.id, id));
    return NextResponse.json({ data: { id } });
  } catch (error) {
    console.error("[DELETE /api/videos/[id]]", error);
    return NextResponse.json({ error: "Failed to delete video" }, { status: 500 });
  }
}
