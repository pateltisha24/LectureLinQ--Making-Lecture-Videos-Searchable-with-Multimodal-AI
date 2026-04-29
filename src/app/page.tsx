"use client";

import Link from "next/link";
import {
  BookOpen,
  Upload,
  Search,
  Sparkles,
  Network,
  ArrowRight,
  Video,
  MessageCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { VideoCard, VideoCardSkeleton } from "@/components/video/VideoCard";
import { useVideos } from "@/hooks/useVideos";

const features = [
  {
    icon: Sparkles,
    title: "AI Summaries",
    description:
      "Get instant summaries of any lecture — full video or section by section.",
    color: "bg-purple-500/10 text-purple-600",
  },
  {
    icon: BookOpen,
    title: "Smart Chapters",
    description:
      "Automatically divided into meaningful chapters with timestamps you can jump to.",
    color: "bg-blue-500/10 text-blue-600",
  },
  {
    icon: MessageCircle,
    title: "Talk to Video",
    description:
      "Ask questions in plain English and get answers with relevant timestamps.",
    color: "bg-green-500/10 text-green-600",
  },
  {
    icon: Search,
    title: "Semantic Search",
    description:
      "Search by meaning, not keywords — find exactly what you need across all lectures.",
    color: "bg-orange-500/10 text-orange-600",
  },
  {
    icon: Network,
    title: "Concept Linking",
    description:
      "Discover when concepts appear across multiple lectures and jump right there.",
    color: "bg-pink-500/10 text-pink-600",
  },
];

export default function DashboardPage() {
  const { data: videos, isLoading } = useVideos();
  const recentVideos = videos?.slice(0, 6) ?? [];

  return (
    <div className="container mx-auto px-4 py-10">
      {/* Hero */}
      <div className="mb-12 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <BookOpen className="h-8 w-8 text-primary" />
        </div>
        <h1 className="mb-3 text-4xl font-bold tracking-tight">
          Learn smarter from every lecture
        </h1>
        <p className="mx-auto max-w-xl text-lg text-muted-foreground">
          LectureLinQ uses AI to summarize, organize, and answer questions about
          your lecture videos — so you focus on understanding, not rewatching.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Link href="/videos/upload">
            <Button size="lg" className="gap-2">
              <Upload className="h-4 w-4" />
              Add Your First Lecture
            </Button>
          </Link>
          <Link href="/search">
            <Button size="lg" variant="outline" className="gap-2">
              <Search className="h-4 w-4" />
              Search Lectures
            </Button>
          </Link>
        </div>
      </div>

      {/* Features */}
      <div className="mb-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {features.map(({ icon: Icon, title, description, color }) => (
          <Card key={title} className="border-0 bg-muted/40">
            <CardContent className="p-5">
              <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${color}`}>
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mb-1 font-semibold">{title}</h3>
              <p className="text-sm text-muted-foreground">{description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent lectures */}
      <div>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Recent Lectures</h2>
          <Link href="/videos">
            <Button variant="ghost" size="sm" className="gap-1">
              View all
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <VideoCardSkeleton key={i} />
            ))}
          </div>
        ) : recentVideos.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed py-16 text-center">
            <Video className="h-12 w-12 text-muted-foreground/30" />
            <div>
              <p className="font-medium">No lectures yet</p>
              <p className="text-sm text-muted-foreground">
                Add your first lecture to get started.
              </p>
            </div>
            <Link href="/videos/upload">
              <Button className="gap-2">
                <Upload className="h-4 w-4" />
                Add a Lecture
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recentVideos.map((video) => (
              <VideoCard key={video.id} video={video} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
