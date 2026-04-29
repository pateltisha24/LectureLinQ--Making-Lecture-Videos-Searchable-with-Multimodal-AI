"use client";

import { BookOpen, RefreshCw, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useRegenerateChapters } from "@/hooks/useVideos";
import { formatTimestamp } from "@/lib/utils";
import type { Chapter } from "@/types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ChapterListProps {
  videoId: string;
  chapters: Chapter[];
  loading?: boolean;
}

export function ChapterList({ videoId, chapters, loading }: ChapterListProps) {
  const regenerate = useRegenerateChapters();

  function copyTimestamp(seconds: number) {
    navigator.clipboard.writeText(formatTimestamp(seconds));
    toast.success(`Copied ${formatTimestamp(seconds)}`);
  }

  async function handleRegenerate() {
    try {
      await regenerate.mutateAsync(videoId);
      toast.success("Chapters regenerated");
    } catch {
      toast.error("Failed to regenerate chapters");
    }
  }

  if (loading) {
    return (
      <div className="space-y-2 p-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (chapters.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
        <BookOpen className="h-10 w-10 text-muted-foreground/40" />
        <div>
          <p className="font-medium">No chapters yet</p>
          <p className="text-sm text-muted-foreground">
            Chapters are auto-generated when the video finishes processing.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRegenerate}
          disabled={regenerate.isPending}
        >
          <RefreshCw className={cn("mr-2 h-4 w-4", regenerate.isPending && "animate-spin")} />
          Generate Now
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <span className="text-sm font-medium text-muted-foreground">
          {chapters.length} chapters
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRegenerate}
          disabled={regenerate.isPending}
        >
          <RefreshCw className={cn("h-3.5 w-3.5", regenerate.isPending && "animate-spin")} />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-1 p-2">
          {chapters.map((chapter, idx) => (
            <div
              key={chapter.id}
              className="rounded-lg p-3 transition-colors hover:bg-muted/40"
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
                  {idx + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-tight">{chapter.title}</p>
                  {chapter.summary && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {chapter.summary}
                    </p>
                  )}
                  <button
                    onClick={() => copyTimestamp(chapter.startTime)}
                    className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
                    title="Click to copy timestamp"
                  >
                    <Clock className="h-3 w-3" />
                    {formatTimestamp(chapter.startTime)}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
