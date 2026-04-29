"use client";

import Link from "next/link";
import Image from "next/image";
import { Clock, Trash2, BookOpen } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDuration, formatRelativeTime } from "@/lib/utils";
import { useDeleteVideo } from "@/hooks/useVideos";
import type { Video } from "@/types";
import { toast } from "sonner";

const statusColors: Record<string, string> = {
  ready: "bg-green-500/10 text-green-600 border-green-200",
  indexing: "bg-yellow-500/10 text-yellow-600 border-yellow-200",
  pending: "bg-gray-500/10 text-gray-600 border-gray-200",
  failed: "bg-red-500/10 text-red-600 border-red-200",
};

const statusLabels: Record<string, string> = {
  ready: "Ready",
  indexing: "Processing...",
  pending: "Pending",
  failed: "Failed",
};

interface VideoCardProps {
  video: Video;
}

export function VideoCard({ video }: VideoCardProps) {
  const deleteMutation = useDeleteVideo();

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    if (!confirm("Delete this lecture?")) return;
    try {
      await deleteMutation.mutateAsync(video.id);
      toast.success("Lecture deleted");
    } catch {
      toast.error("Failed to delete lecture");
    }
  }

  return (
    <Card className="group overflow-hidden transition-shadow hover:shadow-md">
      <Link href={`/videos/${video.id}`}>
        <div className="relative aspect-video w-full overflow-hidden bg-muted">
          {video.thumbnailUrl ? (
            <Image
              src={video.thumbnailUrl}
              alt={video.title}
              fill
              className="object-cover transition-transform group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <BookOpen className="h-12 w-12 text-muted-foreground/30" />
            </div>
          )}
          {video.duration && (
            <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded bg-black/70 px-1.5 py-0.5 text-xs text-white">
              <Clock className="h-3 w-3" />
              {formatDuration(video.duration)}
            </div>
          )}
          <Badge
            className={`absolute left-2 top-2 border text-xs ${statusColors[video.status] ?? ""}`}
          >
            {statusLabels[video.status] ?? video.status}
          </Badge>
        </div>
      </Link>

      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <Link href={`/videos/${video.id}`}>
              <h3 className="line-clamp-2 text-sm font-medium leading-tight hover:text-primary">
                {video.title}
              </h3>
            </Link>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatRelativeTime(video.createdAt)}
            </p>
          </div>
          <button
            onClick={handleDelete}
            className="flex-shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

export function VideoCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <Skeleton className="aspect-video w-full" />
      <CardContent className="p-3">
        <Skeleton className="mb-1 h-4 w-3/4" />
        <Skeleton className="h-3 w-1/3" />
      </CardContent>
    </Card>
  );
}
