# LectureLinQ

**Live demo:** <!-- paste your deployed URL here -->

**Make your lecture videos searchable, summarizable, and conversational — powered by multimodal AI.**

LectureLinQ lets you upload lecture recordings and instantly unlock AI-driven features: semantic search across all your lectures, auto-generated chapter breakdowns with timestamps, full video summaries, key highlights, and a Q&A interface where you can ask questions and get answers grounded in the video content.

Built with [Twelve Labs](https://twelvelabs.io) (Marengo + Pegasus models), [Neon](https://neon.tech) serverless PostgreSQL, and Next.js 16.

---

## Features

| Feature | Description |
|---|---|
| **AI Summaries** | Instant summaries of any lecture — full video or section by section |
| **Smart Chapters** | Auto-divided into 3–8 meaningful chapters with timestamps you can jump to |
| **Talk to Video** | Ask questions in plain English and get answers with relevant timestamps |
| **Semantic Search** | Search by meaning, not keywords — find content across all lectures |
| **Concept Linking** | Discover when concepts appear across multiple lectures |

---

## Tech Stack

- **Framework**: Next.js 16 (App Router, Node.js runtime)
- **Language**: TypeScript
- **AI / Video**: [Twelve Labs API v1.3](https://twelvelabs.io) — Marengo 3.0 (search + embeddings) + Pegasus 1.2 (summaries, chapters, Q&A)
- **Database**: [Neon](https://neon.tech) serverless PostgreSQL via Drizzle ORM
- **UI**: Tailwind CSS v4, shadcn/ui, Radix UI
- **State**: Zustand + TanStack Query
- **Video processing**: `ffmpeg-static` (splits long videos into chunks before upload)

---

## Prerequisites

- **Node.js** 20+
- **pnpm** (recommended) — `npm i -g pnpm`
- A **Twelve Labs** account and API key → [twelvelabs.io](https://twelvelabs.io)
- A **Neon** PostgreSQL database → [neon.tech](https://neon.tech) (free tier works)

---

## Environment Variables

Create a `.env.local` file in the project root:

```env
# Neon PostgreSQL connection string
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require

# Twelve Labs API key
TWELVE_LABS_API_KEY=tlk_your_api_key_here
```

| Variable | Where to get it |
|---|---|
| `DATABASE_URL` | Neon dashboard → your project → Connection string |
| `TWELVE_LABS_API_KEY` | [Twelve Labs dashboard](https://playground.twelvelabs.io) → API Keys |

---

## Local Setup

```bash
# 1. Clone the repo
git clone https://github.com/your-username/LectureLinQ.git
cd LectureLinQ

# 2. Install dependencies
pnpm install

# 3. Set up environment variables
cp .env.local.example .env.local
# Fill in DATABASE_URL and TWELVE_LABS_API_KEY

# 4. Push the database schema to Neon
pnpm db:push

# 5. Start the development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

---

## Database Management

This project uses [Drizzle ORM](https://orm.drizzle.team) with a Neon PostgreSQL backend.

```bash
pnpm db:push      # Push schema changes to the database (quick iteration)
pnpm db:generate  # Generate SQL migration files
pnpm db:migrate   # Run generated migrations
pnpm db:studio    # Open Drizzle Studio (visual database browser)
```

The schema lives in [`src/lib/db/schema.ts`](src/lib/db/schema.ts) and includes tables for videos, video chunks (for long-video splitting), chapters, and summaries.

---

## How It Works

1. **Upload** — You upload a lecture video through the UI. The API route saves it to `/tmp`, probes its duration with ffmpeg, and chunks it if it exceeds 15 minutes.
2. **Index** — Each chunk is uploaded to Twelve Labs, which indexes it with both Marengo (search/embeddings) and Pegasus (understanding) models. The task ID is saved to the database.
3. **Poll** — The status endpoint polls Twelve Labs until indexing is complete, then marks the video as `ready`.
4. **Enrich** — Once ready, you can generate a summary, chapter list, and highlights — all via Pegasus's `/analyze` endpoint.
5. **Search & Q&A** — Marengo powers semantic search across all indexed lectures. Pegasus answers freeform questions about any individual video.

---

## Deployment

See the live demo link at the top of this README.

---

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── videos/
│   │   │   ├── route.ts          # List / create video records
│   │   │   ├── upload/route.ts   # Handle file upload + Twelve Labs indexing
│   │   │   └── [id]/
│   │   │       ├── route.ts      # Get / delete a video
│   │   │       ├── status/       # Poll indexing status
│   │   │       ├── summary/      # Generate AI summary
│   │   │       ├── chapters/     # Generate AI chapters
│   │   │       └── qa/           # Ask a question about the video
│   │   └── search/route.ts       # Semantic search across all lectures
│   ├── videos/
│   │   ├── page.tsx              # All lectures list
│   │   ├── upload/page.tsx       # Upload form
│   │   └── [id]/page.tsx         # Individual lecture page
│   └── search/page.tsx           # Search results page
├── components/
│   ├── video/                    # VideoCard, VideoPlayer, ChapterList, QAInterface, …
│   └── search/                   # SearchBar, SearchResults
├── lib/
│   ├── db/                       # Drizzle schema + client
│   ├── twelvelabs/client.ts      # Twelve Labs API client
│   └── video/chunker.ts          # ffmpeg chunking utilities
└── hooks/                        # useVideos, useSearch, useQA
```

---

## Scripts

```bash
pnpm download   # Download a YouTube video for testing (node scripts/download-youtube.mjs)
pnpm cleanup    # Remove all videos from your Twelve Labs index (node scripts/cleanup-twelvelabs.mjs)
```

---

## License

MIT
