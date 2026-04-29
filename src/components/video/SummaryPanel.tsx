"use client";

import { Sparkles, RefreshCw, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useRegenerateSummary } from "@/hooks/useVideos";
import type { VideoSummary } from "@/types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface SummaryPanelProps {
  videoId: string;
  summary: VideoSummary | null;
  loading?: boolean;
}

export function SummaryPanel({ videoId, summary, loading }: SummaryPanelProps) {
  const regenerate = useRegenerateSummary();

  async function handleRegenerate() {
    try {
      await regenerate.mutateAsync(videoId);
      toast.success("Summary regenerated");
    } catch {
      toast.error("Failed to regenerate summary");
    }
  }

  if (loading) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/6" />
        <Skeleton className="mt-4 h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
        <Sparkles className="h-10 w-10 text-muted-foreground/40" />
        <div>
          <p className="font-medium">No summary yet</p>
          <p className="text-sm text-muted-foreground">
            Summaries are auto-generated when the video finishes processing.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRegenerate}
          disabled={regenerate.isPending}
        >
          <Sparkles className={cn("mr-2 h-4 w-4", regenerate.isPending && "animate-spin")} />
          Generate Now
        </Button>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">AI Summary</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRegenerate}
            disabled={regenerate.isPending}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", regenerate.isPending && "animate-spin")} />
          </Button>
        </div>

        <p className="text-sm leading-relaxed text-foreground/90">{summary.fullSummary}</p>

        {summary.highlights && summary.highlights.length > 0 && (
          <div>
            <div className="mb-3 flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-yellow-500" />
              <span className="text-sm font-medium">Key Highlights</span>
            </div>
            <ul className="space-y-2">
              {summary.highlights.map((highlight, i) => (
                <li key={i} className="flex gap-2 text-sm text-foreground/80">
                  <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
                  <span>{highlight}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
