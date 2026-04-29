import axios, { AxiosInstance } from "axios";
import FormData from "form-data";

const BASE_URL = "https://api.twelvelabs.io/v1.3";

export interface TwelveLabsIndex {
  _id: string;
  index_name: string;
  created_at: string;
  updated_at: string;
  models: Array<{ model_name: string; model_options: string[] }>;
}

export interface TwelveLabsVideo {
  _id: string;
  index_id: string;
  status: "validating" | "pending" | "indexing" | "ready" | "failed";
  metadata?: {
    duration: number;
    filename: string;
    width: number;
    height: number;
  };
  created_at: string;
  updated_at: string;
}

export interface TwelveLabsChapter {
  chapter_number: number;
  start: number;
  end: number;
  chapter_title: string;
  chapter_summary: string;
}

export interface TwelveLabsSummaryResult {
  id: string;
  summary: string;
  chapters?: TwelveLabsChapter[];
  highlights?: string[];
}

export interface TwelveLabsSearchClip {
  score: number;
  start: number;
  end: number;
  video_id: string;
  metadata: Array<{ type: string; text?: string }>;
  confidence: string;
  thumbnail_url?: string;
}

export interface TwelveLabsSearchResult {
  data: TwelveLabsSearchClip[];
  page_info: {
    limit_per_page: number;
    total_results: number;
    page_expired_at: string;
    next_page_token?: string;
  };
}

export interface TwelveLabsQAResult {
  id: string;
  answer: string;
}

class TwelveLabsClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: BASE_URL,
      headers: {
        "x-api-key": process.env.TWELVE_LABS_API_KEY,
      },
    });
  }

  // ── Index Management ──────────────────────────────────────────────────────

  async getOrCreateIndex(indexName: string): Promise<TwelveLabsIndex> {
    const listRes = await this.client.get<{ data: TwelveLabsIndex[] }>("/indexes", {
      params: { index_name: indexName },
    });

    if (listRes.data.data.length > 0) {
      return listRes.data.data[0];
    }

    // v1.3 format: "models" (not "engines"), options are "visual" + "audio"
    const createRes = await this.client.post<TwelveLabsIndex>(
      "/indexes",
      {
        index_name: indexName,
        models: [
          {
            model_name: "marengo3.0",
            model_options: ["visual", "audio"],
          },
          {
            model_name: "pegasus1.2",
            model_options: ["visual", "audio"],
          },
        ],
        addons: ["thumbnail"],
      },
      { headers: { "Content-Type": "application/json" } }
    );

    return createRes.data;
  }

  // ── Video Upload ──────────────────────────────────────────────────────────

  // v1.3 requires multipart/form-data for task creation
  async uploadVideoByUrl(
    indexId: string,
    videoUrl: string,
    title?: string
  ): Promise<string> {
    const form = new FormData();
    form.append("index_id", indexId);
    form.append("video_url", videoUrl);
    if (title) form.append("video_title", title);

    const res = await this.client.post<{ _id: string }>("/tasks", form, {
      headers: form.getHeaders(),
    });
    return res.data._id;
  }

  async uploadVideoFile(
    indexId: string,
    file: Buffer,
    filename: string,
    title?: string
  ): Promise<string> {
    const form = new FormData();
    form.append("index_id", indexId);
    form.append("video_file", file, { filename });
    if (title) form.append("video_title", title);

    const res = await this.client.post<{ _id: string }>("/tasks", form, {
      headers: form.getHeaders(),
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });
    return res.data._id;
  }

  async getTaskStatus(taskId: string): Promise<{
    status: string;
    videoId?: string;
    error?: string;
  }> {
    const res = await this.client.get<{
      _id: string;
      status: string;
      video_id?: string;
      error?: { message: string };
    }>(`/tasks/${taskId}`);

    return {
      status: res.data.status,
      videoId: res.data.video_id,
      error: res.data.error?.message,
    };
  }

  // ── Video Info ────────────────────────────────────────────────────────────

  async getVideo(indexId: string, videoId: string): Promise<TwelveLabsVideo> {
    const res = await this.client.get<TwelveLabsVideo>(
      `/indexes/${indexId}/videos/${videoId}`
    );
    return res.data;
  }

  async deleteVideo(indexId: string, videoId: string): Promise<void> {
    // v1.3: file-uploaded videos are "indexed-assets" and require a separate
    // delete endpoint. asset_id == video _id for our flow.
    await this.client.delete(
      `/indexes/${indexId}/indexed-assets/${videoId}`
    );
  }

  async listVideos(
    indexId: string
  ): Promise<Array<{ _id: string; system_metadata?: { duration?: number; video_title?: string; filename?: string } }>> {
    const res = await this.client.get<{
      data: Array<{
        _id: string;
        system_metadata?: { duration?: number; video_title?: string; filename?: string };
      }>;
    }>(`/indexes/${indexId}/videos`, { params: { page_limit: 50 } });
    return res.data.data;
  }

  async getVideoThumbnail(indexId: string, videoId: string): Promise<string | null> {
    try {
      const res = await this.client.get<{ thumbnail_urls: string[] }>(
        `/indexes/${indexId}/videos/${videoId}/thumbnail`
      );
      return res.data.thumbnail_urls?.[0] ?? null;
    } catch {
      return null;
    }
  }

  // ── Pegasus /analyze (replaces /summarize + /generate in v1.3) ───────────

  private async analyze(videoId: string, prompt: string): Promise<string> {
    const res = await this.client.post<{ data: string }>(
      "/analyze",
      { video_id: videoId, prompt, stream: false },
      { headers: { "Content-Type": "application/json" } }
    );
    return res.data.data;
  }

  async generateSummary(videoId: string): Promise<TwelveLabsSummaryResult> {
    const summary = await this.analyze(
      videoId,
      "Generate a comprehensive summary of this lecture video in 4-6 sentences. Focus on the main topics, key concepts, and important takeaways for students."
    );
    return { id: "", summary };
  }

  async generateChapters(videoId: string): Promise<TwelveLabsChapter[]> {
    const text = await this.analyze(
      videoId,
      `Divide this lecture into 3-8 meaningful chapters. For each chapter, provide a descriptive title and the start time in seconds. Respond ONLY with valid JSON in this exact format, with no markdown code fences or other text:
[
  {"chapter_number": 1, "start": 0, "end": 60, "chapter_title": "Introduction", "chapter_summary": "Brief overview of what's covered"}
]`
    );

    // Strip markdown fences if present, then parse
    const cleaned = text
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/, "")
      .trim();

    try {
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) return parsed;
    } catch (err) {
      console.error("[generateChapters] failed to parse:", cleaned.slice(0, 200), err);
    }
    return [];
  }

  async generateHighlights(videoId: string): Promise<string[]> {
    const text = await this.analyze(
      videoId,
      `Extract 3-5 key highlights from this lecture as a JSON array of strings. Respond ONLY with valid JSON in this exact format, with no markdown code fences or other text:
["First key highlight", "Second key highlight", "Third key highlight"]`
    );
    const cleaned = text
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/, "")
      .trim();
    try {
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) return parsed.filter((s): s is string => typeof s === "string");
    } catch {
      // Fallback: split by newlines
      return text
        .split(/\n+/)
        .map((s) => s.replace(/^[-*•\d.\s]+/, "").trim())
        .filter(Boolean)
        .slice(0, 5);
    }
    return [];
  }

  async askQuestion(videoId: string, question: string): Promise<TwelveLabsQAResult> {
    const answer = await this.analyze(videoId, question);
    return { id: "", answer };
  }

  // ── Marengo: Semantic Search ──────────────────────────────────────────────

  async semanticSearch(
    indexId: string,
    query: string,
    options: {
      searchOptions?: string[];
      threshold?: number;
      pageLimit?: number;
      videoIds?: string[];
    } = {}
  ): Promise<TwelveLabsSearchResult> {
    // v1.3 search uses multipart/form-data, response uses `rank` + `transcription`
    const form = new FormData();
    form.append("index_id", indexId);
    form.append("query_text", query);
    for (const opt of options.searchOptions ?? ["visual", "audio"]) {
      form.append("search_options", opt);
    }
    form.append("page_limit", String(options.pageLimit ?? 10));
    if (options.videoIds?.length) {
      form.append("filter", JSON.stringify({ id: options.videoIds }));
    }

    type V13SearchClip = {
      rank?: number;
      score?: number;
      start: number;
      end: number;
      video_id: string;
      transcription?: string;
      thumbnail_url?: string;
      confidence?: string;
    };
    const res = await this.client.post<{
      data: V13SearchClip[];
      page_info: TwelveLabsSearchResult["page_info"];
    }>("/search", form, { headers: form.getHeaders() });

    // Normalize v1.3 response to our existing TwelveLabsSearchClip shape
    const data: TwelveLabsSearchClip[] = res.data.data.map((c) => ({
      score: c.score ?? (c.rank ? 1 / c.rank : 0),
      start: c.start,
      end: c.end,
      video_id: c.video_id,
      thumbnail_url: c.thumbnail_url,
      confidence: c.confidence ?? "medium",
      metadata: c.transcription
        ? [{ type: "conversation", text: c.transcription }]
        : [],
    }));

    return { data, page_info: res.data.page_info };
  }

  // ── Marengo: Embeddings for Concept Linking ───────────────────────────────

  async getTextEmbedding(text: string): Promise<number[]> {
    const res = await this.client.post<{
      text_embedding: { segments: Array<{ embeddings_float: number[] }> };
    }>(
      "/embed",
      { engine_name: "Marengo-retrieval-2.7", text },
      { headers: { "Content-Type": "application/json" } }
    );
    return res.data.text_embedding.segments[0]?.embeddings_float ?? [];
  }
}

export const twelveLabsClient = new TwelveLabsClient();
