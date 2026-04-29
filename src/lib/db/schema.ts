import {
  pgTable,
  text,
  timestamp,
  integer,
  real,
  pgEnum,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";

export const videoStatusEnum = pgEnum("video_status", [
  "pending",
  "indexing",
  "ready",
  "failed",
]);

export const sourceTypeEnum = pgEnum("source_type", ["upload", "url"]);

export const videos = pgTable(
  "videos",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    title: text("title").notNull(),
    description: text("description"),
    twelveLabsVideoId: text("twelve_labs_video_id"),
    twelveLabsIndexId: text("twelve_labs_index_id"),
    status: videoStatusEnum("status").notNull().default("pending"),
    duration: real("duration"),
    thumbnailUrl: text("thumbnail_url"),
    videoUrl: text("video_url"),
    sourceType: sourceTypeEnum("source_type").notNull().default("upload"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("videos_status_idx").on(table.status),
    index("videos_twelve_labs_video_id_idx").on(table.twelveLabsVideoId),
  ]
);

// Video chunks — one row per ffmpeg-split segment uploaded to Twelve Labs.
// Short videos still get one row (chunk_index = 0, offset = 0).
export const videoChunks = pgTable(
  "video_chunks",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    videoId: text("video_id")
      .notNull()
      .references(() => videos.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunk_index").notNull(),
    startOffsetSec: real("start_offset_sec").notNull().default(0),
    durationSec: real("duration_sec").notNull(),
    twelveLabsVideoId: text("twelve_labs_video_id"),
    twelveLabsTaskId: text("twelve_labs_task_id"),
    status: videoStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("video_chunks_video_id_idx").on(table.videoId)]
);

export const chapters = pgTable(
  "chapters",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    videoId: text("video_id")
      .notNull()
      .references(() => videos.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    startTime: real("start_time").notNull(),
    endTime: real("end_time"),
    summary: text("summary"),
    orderIndex: integer("order_index").notNull().default(0),
  },
  (table) => [index("chapters_video_id_idx").on(table.videoId)]
);

export const videoSummaries = pgTable("video_summaries", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  videoId: text("video_id")
    .notNull()
    .unique()
    .references(() => videos.id, { onDelete: "cascade" }),
  fullSummary: text("full_summary").notNull(),
  highlights: jsonb("highlights").$type<string[]>().notNull().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Relations
export const videosRelations = relations(videos, ({ one, many }) => ({
  chapters: many(chapters),
  summary: one(videoSummaries),
  chunks: many(videoChunks),
}));

export const videoChunksRelations = relations(videoChunks, ({ one }) => ({
  video: one(videos, { fields: [videoChunks.videoId], references: [videos.id] }),
}));

export const chaptersRelations = relations(chapters, ({ one }) => ({
  video: one(videos, { fields: [chapters.videoId], references: [videos.id] }),
}));

export const videoSummariesRelations = relations(videoSummaries, ({ one }) => ({
  video: one(videos, {
    fields: [videoSummaries.videoId],
    references: [videos.id],
  }),
}));

export type VideoInsert = typeof videos.$inferInsert;
export type VideoSelect = typeof videos.$inferSelect;
export type VideoChunkInsert = typeof videoChunks.$inferInsert;
export type VideoChunkSelect = typeof videoChunks.$inferSelect;
export type ChapterInsert = typeof chapters.$inferInsert;
export type ChapterSelect = typeof chapters.$inferSelect;
export type VideoSummaryInsert = typeof videoSummaries.$inferInsert;
export type VideoSummarySelect = typeof videoSummaries.$inferSelect;
