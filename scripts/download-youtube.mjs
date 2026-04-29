#!/usr/bin/env node
/**
 * Download + compress YouTube videos for upload to Twelve Labs.
 *
 * The pipeline:
 *   1. yt-dlp downloads at the cheapest reasonable quality
 *   2. ffmpeg re-encodes with very low bitrate so 1+ hour lectures fit under
 *      the ~25MB upload-size limit (lectures are audio-heavy, so this is fine)
 *
 * Usage:
 *   npm run download <url>                       # full lecture, compressed
 *   npm run download -- --minutes 10 <url>       # first 10 min only
 *   npm run download -- --no-compress <url>      # raw download (will fail upload if >25MB)
 *
 * Saved to: ./videos/<title>.mp4
 */

import ytDlp from "yt-dlp-exec";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { existsSync } from "node:fs";

const OUTPUT_DIR = path.resolve(process.cwd(), "videos");
const TARGET_MB = 22;          // stay under the ~25MB upload-size limit
const MAX_CHUNK_SEC = 50 * 60; // Twelve Labs caps at 60 min per video; we use 50

// ── Parse args ─────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
let clipMinutes = null;
let compress = true;
const urls = [];

for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "--no-compress") { compress = false; continue; }
  if (a === "--minutes") { clipMinutes = parseInt(args[++i], 10); continue; }
  urls.push(a);
}

if (urls.length === 0) {
  console.log("\n📺  YouTube Video Downloader for Twelve Labs\n");
  console.log("Usage:");
  console.log("  npm run download <url>                    # full lecture, compressed");
  console.log("  npm run download -- --minutes 10 <url>    # first 10 min only");
  console.log("  npm run download -- --no-compress <url>   # raw download (no compression)\n");
  console.log("By default, ffmpeg compresses lectures so they fit under the upload-size limit.");
  console.log("Quality: 360p video + clear audio — perfect for transcription & analysis.\n");
  process.exit(0);
}

if (!existsSync(OUTPUT_DIR)) {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
}

function sanitize(name) {
  return name.replace(/[<>:"/\\|?*]/g, "").replace(/\s+/g, " ").trim().slice(0, 100);
}

function fmt(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}m ${s}s`;
}

function pickBitrates(durationSec) {
  // Target ~TARGET_MB total file size. ffmpeg uses 1000-base kbps.
  const totalKbps = Math.floor((TARGET_MB * 8000) / durationSec);
  // Audio gets a small fixed share — speech needs ~24kbps minimum to stay clear
  const audioKbps = totalKbps < 60 ? 24 : 32;
  // Video gets the rest, with a hard minimum of 12kbps (slideshow-style)
  const videoKbps = Math.max(12, totalKbps - audioKbps);
  return { videoKbps, audioKbps, totalKbps };
}

function runFFmpeg(args) {
  return new Promise((resolve, reject) => {
    const ff = spawn("ffmpeg", args);
    ff.stderr.on("data", (chunk) => {
      const line = chunk.toString().trim();
      const match = line.match(/time=(\d+:\d+:\d+\.\d+)/);
      if (match) process.stdout.write(`\r     ⏱️  ${match[1]}`);
    });
    ff.on("close", (code) => {
      process.stdout.write("\n");
      code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`));
    });
    ff.on("error", reject);
  });
}

async function compressWithFFmpeg(input, output, durationSec) {
  const { videoKbps, audioKbps, totalKbps } = pickBitrates(durationSec);
  // Twelve Labs requires min 360p — never go below
  const height = 360;
  // For tight bitrate budgets, drop fps. Lectures don't need motion smoothness.
  const fps = videoKbps < 30 ? 5 : videoKbps < 50 ? 8 : videoKbps < 80 ? 12 : 15;

  console.log(
    `     🎛️  Target ${TARGET_MB}MB · ${totalKbps}kbps · ${height}p@${fps}fps · audio ${audioKbps}kbps mono`
  );

  // 2-pass encoding for accurate size targeting
  const passlog = path.join(path.dirname(output), `.ffpass-${Date.now()}`);
  const commonArgs = [
    "-y", "-i", input,
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-b:v", `${videoKbps}k`,
    "-vf", `scale=-2:${height},fps=${fps}`,
    "-passlogfile", passlog,
    "-loglevel", "error", "-stats",
  ];

  // Pass 1
  console.log(`     ⏳ Pass 1/2 (analysis)`);
  await runFFmpeg([...commonArgs, "-pass", "1", "-an", "-f", "null", process.platform === "win32" ? "NUL" : "/dev/null"]);

  // Pass 2
  console.log(`     ⏳ Pass 2/2 (encoding)`);
  await runFFmpeg([
    ...commonArgs,
    "-pass", "2",
    "-c:a", "aac", "-b:a", `${audioKbps}k`, "-ac", "1", "-ar", "22050",
    "-movflags", "+faststart",
    output,
  ]);

  // Cleanup pass log files
  for (const ext of [".log", ".log.mbtree"]) {
    try { await fs.unlink(passlog + "-0" + ext); } catch {}
    try { await fs.unlink(passlog + ext); } catch {}
  }
}

async function clipWithFFmpeg(input, output, startSec, durationSec) {
  await runFFmpeg([
    "-y", "-ss", String(startSec), "-i", input, "-t", String(durationSec),
    "-c", "copy", "-loglevel", "error", output,
  ]);
}

async function download(url, index) {
  const prefix = `[${index + 1}/${urls.length}]`;
  console.log(`\n${prefix} 🔍 Fetching info: ${url}`);

  let info;
  try {
    info = await ytDlp(url, { dumpSingleJson: true, noWarnings: true, skipDownload: true });
  } catch (err) {
    console.error(`${prefix} ❌ Could not fetch info: ${err.stderr ?? err.message}`);
    return;
  }

  const title = sanitize(info.title);
  const fullDuration = info.duration;
  const effectiveDuration = clipMinutes ? Math.min(clipMinutes * 60, fullDuration) : fullDuration;
  const willClip = clipMinutes !== null && fullDuration > clipMinutes * 60;
  const downloadSec = willClip ? clipMinutes * 60 : fullDuration;

  console.log(`${prefix} 📌 ${info.title}`);
  console.log(`${prefix}    Duration: ${fmt(fullDuration)}${willClip ? ` (clipping to ${clipMinutes}m)` : ""} · ${info.uploader}`);

  // ── Decide whether we need to split into multiple chunks ──
  const needsSplit = effectiveDuration > MAX_CHUNK_SEC;
  const numChunks = needsSplit ? Math.ceil(effectiveDuration / MAX_CHUNK_SEC) : 1;
  if (needsSplit) {
    console.log(
      `${prefix} ✂️  Twelve Labs caps at 60 min per video — splitting into ${numChunks} chunks of ~${Math.ceil(effectiveDuration / numChunks / 60)} min each`
    );
  }

  // Step 1: download the (possibly clipped) source once
  const tmpPath = path.join(OUTPUT_DIR, `.tmp-source-${Date.now()}.mp4`);
  console.log(`${prefix} ⬇️  Downloading...`);
  const ytOpts = {
    output: tmpPath,
    format: "18/best[ext=mp4][height<=360]/best[height<=360]/worst",
    noWarnings: true,
  };
  if (willClip) {
    ytOpts.downloadSections = `*0-${downloadSec}`;
    ytOpts.forceKeyframesAtCuts = true;
  }

  try {
    await ytDlp(url, ytOpts);
  } catch (err) {
    console.error(`${prefix} ❌ Download failed: ${err.stderr ?? err.message}`);
    return;
  }

  // Step 2: process — single file or chunked
  const baseSuffix = willClip ? ` (first ${clipMinutes}m)` : "";
  const chunkLen = effectiveDuration / numChunks;

  for (let i = 0; i < numChunks; i++) {
    const partSuffix =
      numChunks > 1 ? ` — Part ${i + 1} of ${numChunks}` : "";
    const outName = `${title}${baseSuffix}${partSuffix}.mp4`;
    const outPath = path.join(OUTPUT_DIR, outName);

    if (existsSync(outPath)) {
      console.log(`${prefix} ⏭️  Already exists — skipping (${outName})`);
      continue;
    }

    if (numChunks > 1) {
      // Slice this chunk first, then compress it
      const sliceTmp = path.join(OUTPUT_DIR, `.tmp-slice-${Date.now()}-${i}.mp4`);
      console.log(`${prefix} 🔪 Chunk ${i + 1}/${numChunks}: extracting ${fmt(chunkLen)}`);
      await clipWithFFmpeg(tmpPath, sliceTmp, i * chunkLen, chunkLen);

      if (compress) {
        try {
          await compressWithFFmpeg(sliceTmp, outPath, chunkLen);
          await fs.unlink(sliceTmp);
        } catch (err) {
          console.error(`${prefix} ❌ Compression failed: ${err.message}`);
          await fs.rename(sliceTmp, outPath);
        }
      } else {
        await fs.rename(sliceTmp, outPath);
      }
    } else {
      // Single file path
      if (compress) {
        try {
          await compressWithFFmpeg(tmpPath, outPath, effectiveDuration);
        } catch (err) {
          console.error(`${prefix} ❌ Compression failed: ${err.message}`);
          await fs.copyFile(tmpPath, outPath);
        }
      } else {
        await fs.copyFile(tmpPath, outPath);
      }
    }

    const stats = await fs.stat(outPath);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(1);
    const ok = parseFloat(sizeMB) <= 25;
    console.log(`${prefix} ${ok ? "✅" : "⚠️ "} ${outName} (${sizeMB} MB)`);
  }

  // Cleanup source
  try { await fs.unlink(tmpPath); } catch {}
}

console.log(`\n🚀 Downloading ${urls.length} video${urls.length !== 1 ? "s" : ""}${compress ? " (compressed)" : ""}...`);
for (let i = 0; i < urls.length; i++) await download(urls[i], i);
console.log(`\n✨ Done! Files saved to: ${OUTPUT_DIR}`);
console.log(`   Open the app and use the "Upload File" tab.\n`);
