#!/usr/bin/env node
/**
 * Clear all video records from the local DB.
 * Cascade deletes will handle chunks, chapters, summaries.
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

const before = await sql`SELECT count(*)::int AS n FROM videos`;
console.log(`Before: ${before[0].n} videos in DB`);

await sql`DELETE FROM videos`;

const after = await sql`SELECT count(*)::int AS n FROM videos`;
console.log(`After:  ${after[0].n} videos in DB`);
console.log("✨ Done. All video records cleared.");
