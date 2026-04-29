"use client";

import Link from "next/link";
import { Upload, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VideoCard, VideoCardSkeleton } from "@/components/video/VideoCard";
import { useVideos } from "@/hooks/useVideos";
import { useState } from "react";

export default function VideosPage() {
  const { data: videos, isLoading } = useVideos();
  const [search, setSearch] = useState("");

  const filtered = videos?.filter((v) =>
    v.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">My Lectures</h1>
          <p className="text-sm text-muted-foreground">
            {videos?.length ?? 0} lecture{(videos?.length ?? 0) !== 1 ? "s" : ""}
          </p>
        </div>
        <Link href="/videos/upload">
          <Button className="gap-2">
            <Upload className="h-4 w-4" />
            Add Lecture
          </Button>
        </Link>
      </div>

      <div className="mb-6">
        <Input
          placeholder="Filter lectures..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <VideoCardSkeleton key={i} />
          ))}
        </div>
      ) : !filtered || filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed py-20 text-center">
          <Video className="h-12 w-12 text-muted-foreground/30" />
          <div>
            <p className="font-medium">
              {search ? "No lectures match your search" : "No lectures yet"}
            </p>
            <p className="text-sm text-muted-foreground">
              {search
                ? "Try a different search term."
                : "Add your first lecture to get started."}
            </p>
          </div>
          {!search && (
            <Link href="/videos/upload">
              <Button className="gap-2">
                <Upload className="h-4 w-4" />
                Add a Lecture
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((video) => (
            <VideoCard key={video.id} video={video} />
          ))}
        </div>
      )}
    </div>
  );
}
