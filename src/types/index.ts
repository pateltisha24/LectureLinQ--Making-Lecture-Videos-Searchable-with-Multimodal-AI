export type VideoStatus =
  | "pending"
  | "indexing"
  | "ready"
  | "failed";

export interface Video {
  id: string;
  title: string;
  description: string | null;
  twelveLabsVideoId: string | null;
  twelveLabsIndexId: string | null;
  status: VideoStatus;
  duration: number | null;
  thumbnailUrl: string | null;
  videoUrl: string | null;
  sourceType: "upload" | "url";
  createdAt: string;
  updatedAt: string;
}

export interface Chapter {
  id: string;
  videoId: string;
  title: string;
  startTime: number;
  endTime: number | null;
  summary: string | null;
  orderIndex: number;
}

export interface VideoSummary {
  id: string;
  videoId: string;
  fullSummary: string;
  highlights: string[];
  createdAt: string;
}

export interface ConceptLink {
  id: string;
  concept: string;
  sourceVideoId: string;
  sourceTimestamp: number;
  targetVideoId: string;
  targetTimestamp: number;
  similarityScore: number;
  sourceVideo?: Pick<Video, "id" | "title" | "thumbnailUrl">;
  targetVideo?: Pick<Video, "id" | "title" | "thumbnailUrl">;
}

export interface QAMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamps?: number[];
  segments?: Array<{
    start: number;
    end: number;
    text: string;
  }>;
  createdAt: string;
}

export interface SearchResult {
  videoId: string;
  video?: Pick<Video, "id" | "title" | "thumbnailUrl">;
  startTime: number;
  endTime: number;
  score: number;
  text: string;
}

export interface VideoUploadForm {
  title: string;
  description?: string;
  file?: File;
  url?: string;
  sourceType: "upload" | "url";
}

export interface ApiResponse<T> {
  data: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}
