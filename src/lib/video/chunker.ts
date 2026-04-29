/**
 * Video chunking utilities — splits long videos into smaller segments
 * before uploading to Twelve Labs. Uses ffmpeg via the bundled binary.
 *
 * Lectures longer than CHUNK_THRESHOLD_SEC are split into chunks of ~CHUNK_DURATION_SEC.
 * Stream-copy is used (no re-encoding) for speed, so chunks are split on the
 * nearest keyframe — accurate enough for lecture content.
 */
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import ffmpegPath from "ffmpeg-static";

// Chunk if the video is longer than this many seconds (15 minutes)
export const CHUNK_THRESHOLD_SEC = 15 * 60;
// Each chunk is roughly this many seconds (12 minutes) — keeps uploads small + reliable
export const CHUNK_DURATION_SEC = 12 * 60;

/**
 * Resolve the ffmpeg binary path. Next.js's bundler can rewrite __dirname
 * inside ffmpeg-static and produce paths like "\ROOT\node_modules\..." that
 * don't exist. Fall back to looking in the project's actual node_modules.
 */
function resolveFfmpeg(): string {
  if (ffmpegPath && existsSync(ffmpegPath)) return ffmpegPath;

  const isWin = process.platform === "win32";
  const binName = isWin ? "ffmpeg.exe" : "ffmpeg";

  // Try standard node_modules location relative to the project root (cwd in dev)
  const candidates = [
    path.join(process.cwd(), "node_modules", "ffmpeg-static", binName),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }

  throw new Error(
    `ffmpeg binary not found. Looked at: ${ffmpegPath ?? "(null)"}, ${candidates.join(", ")}`
  );
}

const FFMPEG = resolveFfmpeg();

export interface VideoChunkInfo {
  index: number;
  startOffsetSec: number;
  durationSec: number;
  filePath: string;
}

/** Probe a video for its total duration in seconds using ffmpeg. */
export async function probeDuration(filePath: string): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const proc = spawn(FFMPEG, ["-i", filePath, "-hide_banner"], {
      stdio: ["ignore", "ignore", "pipe"],
    });
    let stderr = "";
    proc.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    proc.on("close", () => {
      // ffmpeg writes "Duration: HH:MM:SS.xx" to stderr
      const m = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
      if (!m) return reject(new Error("Could not probe video duration"));
      const [, h, mm, s] = m;
      resolve(Number(h) * 3600 + Number(mm) * 60 + Number(s));
    });
    proc.on("error", reject);
  });
}

/**
 * Split a video into sequential chunks. If the video is shorter than the
 * threshold, returns a single "chunk" pointing at the original file.
 *
 * Caller is responsible for cleaning up the temp directory via {@link cleanupChunks}.
 */
export async function chunkVideo(
  inputPath: string,
  durationSec: number
): Promise<{ chunks: VideoChunkInfo[]; tempDir: string | null }> {
  // Short video — no chunking needed
  if (durationSec <= CHUNK_THRESHOLD_SEC) {
    return {
      chunks: [
        {
          index: 0,
          startOffsetSec: 0,
          durationSec,
          filePath: inputPath,
        },
      ],
      tempDir: null,
    };
  }

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "lecturelinq-chunks-"));
  const chunks: VideoChunkInfo[] = [];
  let chunkIndex = 0;
  let offset = 0;

  while (offset < durationSec) {
    const remaining = durationSec - offset;
    const thisDuration = Math.min(CHUNK_DURATION_SEC, remaining);
    const outPath = path.join(tempDir, `chunk-${chunkIndex}.mp4`);

    await runFfmpeg([
      "-y",
      "-ss", String(offset),     // seek before -i for fast input seek
      "-i", inputPath,
      "-t", String(thisDuration),
      "-c", "copy",              // stream copy — no re-encode
      "-avoid_negative_ts", "make_zero",
      "-map_metadata", "-1",     // strip metadata
      outPath,
    ]);

    chunks.push({
      index: chunkIndex,
      startOffsetSec: offset,
      durationSec: thisDuration,
      filePath: outPath,
    });

    offset += thisDuration;
    chunkIndex += 1;
  }

  return { chunks, tempDir };
}

/** Clean up the temp directory created by chunkVideo. */
export async function cleanupChunks(tempDir: string | null): Promise<void> {
  if (!tempDir) return;
  await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
}

/** Write an uploaded File to a temp path so ffmpeg can read it. */
export async function writeUploadToTemp(file: File): Promise<string> {
  const ext = path.extname(file.name) || ".mp4";
  const tempPath = path.join(os.tmpdir(), `lecturelinq-upload-${randomUUID()}${ext}`);
  const buf = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(tempPath, buf);
  return tempPath;
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(FFMPEG, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    proc.stderr.on("data", (c) => { stderr += c.toString(); });
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-500)}`));
    });
    proc.on("error", reject);
  });
}
