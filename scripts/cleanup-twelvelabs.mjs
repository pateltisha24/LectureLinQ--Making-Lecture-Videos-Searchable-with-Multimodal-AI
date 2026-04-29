#!/usr/bin/env node
/**
 * List or delete videos in your Twelve Labs index to free up quota.
 *
 * Usage:
 *   node scripts/cleanup-twelvelabs.mjs           # list all indexed videos + total duration
 *   node scripts/cleanup-twelvelabs.mjs --all     # delete ALL videos (frees quota)
 *   node scripts/cleanup-twelvelabs.mjs <id>      # delete one video by ID
 */

import "dotenv/config";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import axios from "axios";

const KEY = process.env.TWELVE_LABS_API_KEY;
const BASE = "https://api.twelvelabs.io/v1.3";
const INDEX_NAME = "lecturelinq-index";

if (!KEY) { console.error("❌ TWELVE_LABS_API_KEY missing"); process.exit(1); }

const http = axios.create({ baseURL: BASE, headers: { "x-api-key": KEY } });

function fmt(secs) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  return h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`;
}

async function main() {
  const arg = process.argv[2];

  // List all indexes (so user can see all of them, not just lecturelinq)
  const idxRes = await http.get("/indexes");
  const indexes = idxRes.data.data;

  let totalSec = 0;
  const allVideos = [];

  for (const idx of indexes) {
    const v = await http.get(`/indexes/${idx._id}/videos`, { params: { page_limit: 50 } });
    for (const video of v.data.data) {
      const dur = video.system_metadata?.duration ?? 0;
      totalSec += dur;
      allVideos.push({
        indexId: idx._id,
        indexName: idx.index_name,
        videoId: video._id,
        title: video.system_metadata?.video_title ?? video.system_metadata?.filename ?? "(untitled)",
        duration: dur,
      });
    }
  }

  console.log(`\n📊 Total indexed: ${allVideos.length} videos · ${fmt(totalSec)}\n`);

  if (allVideos.length === 0) {
    console.log("✨ Index is already empty.\n");
    return;
  }

  console.log("Indexed videos:");
  console.log("─".repeat(80));
  allVideos.forEach((v, i) => {
    console.log(`${String(i + 1).padStart(2)}. ${v.title.slice(0, 50).padEnd(50)} ${fmt(v.duration).padStart(10)}  ${v.videoId}`);
    console.log(`    └ index: ${v.indexName}`);
  });
  console.log("─".repeat(80));

  if (!arg) {
    console.log("\nTo delete:");
    console.log("  node scripts/cleanup-twelvelabs.mjs --all          # delete everything");
    console.log("  node scripts/cleanup-twelvelabs.mjs <video-id>     # delete one\n");
    return;
  }

  let toDelete;
  if (arg === "--all") {
    toDelete = allVideos;
    console.log(`\n⚠️  Deleting ALL ${toDelete.length} videos in 3 seconds... (Ctrl+C to cancel)`);
    await new Promise((r) => setTimeout(r, 3000));
  } else {
    toDelete = allVideos.filter((v) => v.videoId === arg);
    if (toDelete.length === 0) {
      console.error(`❌ No video with id ${arg} found.`);
      process.exit(1);
    }
  }

  for (const v of toDelete) {
    try {
      // v1.3: file-uploaded videos are deleted via indexed-assets endpoint
      await http.delete(`/indexes/${v.indexId}/indexed-assets/${v.videoId}`);
      console.log(`✅ Deleted: ${v.title}`);
    } catch (e) {
      // Fall back to legacy /videos endpoint for any direct-URL ingested videos
      try {
        await http.delete(`/indexes/${v.indexId}/videos/${v.videoId}`);
        console.log(`✅ Deleted (legacy): ${v.title}`);
      } catch (e2) {
        console.error(
          `❌ Failed ${v.videoId}:`,
          e2.response?.data?.message ?? e.response?.data?.message ?? e.message
        );
      }
    }
  }

  console.log(`\n✨ Freed up ${fmt(toDelete.reduce((s, v) => s + v.duration, 0))} of quota.\n`);
}

main().catch((e) => {
  console.error("Error:", e.response?.data ?? e.message);
  process.exit(1);
});
