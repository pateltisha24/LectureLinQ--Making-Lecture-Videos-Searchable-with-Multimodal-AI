import { NextRequest, NextResponse } from "next/server";
import { db, videos } from "@/lib/db";
import { desc, eq } from "drizzle-orm";
import { twelveLabsClient } from "@/lib/twelvelabs/client";
import { z } from "zod";

const createVideoSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  url: z.string().url().optional(),
  sourceType: z.enum(["upload", "url"]),
});

const INDEX_NAME = "lecturelinq-index";

export async function GET() {
  try {
    const allVideos = await db
      .select()
      .from(videos)
      .orderBy(desc(videos.createdAt));

    return NextResponse.json({ data: allVideos });
  } catch (error) {
    console.error("[GET /api/videos]", error);
    return NextResponse.json({ error: "Failed to fetch videos" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = createVideoSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { title, description, url, sourceType } = parsed.data;

    // Get or create Twelve Labs index
    const index = await twelveLabsClient.getOrCreateIndex(INDEX_NAME);

    let twelveLabsTaskId: string | null = null;

    if (sourceType === "url" && url) {
      twelveLabsTaskId = await twelveLabsClient.uploadVideoByUrl(
        index._id,
        url,
        title
      );
    }

    const [video] = await db
      .insert(videos)
      .values({
        title,
        description: description ?? null,
        twelveLabsIndexId: index._id,
        status: twelveLabsTaskId ? "indexing" : "pending",
        videoUrl: url ?? null,
        sourceType,
      })
      .returning();

    // Store the task ID temporarily so the status poller can use it
    if (twelveLabsTaskId) {
      await db
        .update(videos)
        .set({ twelveLabsVideoId: `task:${twelveLabsTaskId}` })
        .where(eq(videos.id, video.id));
    }

    return NextResponse.json({ data: video }, { status: 201 });
  } catch (error: unknown) {
    console.error("[POST /api/videos]", error);
    // Surface the Twelve Labs error message if available
    const tlMessage =
      (error as { response?: { data?: { message?: string } } })?.response?.data
        ?.message;
    return NextResponse.json(
      { error: tlMessage ?? "Failed to create video" },
      { status: 500 }
    );
  }
}
