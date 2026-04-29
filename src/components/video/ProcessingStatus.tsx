"use client";

import { useEffect } from "react";
import { Loader2, XCircle, Clock } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useVideoStatus } from "@/hooks/useVideos";
import { useQueryClient } from "@tanstack/react-query";

interface ProcessingStatusProps {
  videoId: string;
  onReady?: () => void;
}

export function ProcessingStatus({ videoId, onReady }: ProcessingStatusProps) {
  const qc = useQueryClient();
  const { data } = useVideoStatus(videoId, true);

  useEffect(() => {
    if (data?.status === "ready") {
      qc.invalidateQueries({ queryKey: ["video", videoId] });
      qc.invalidateQueries({ queryKey: ["chapters", videoId] });
      qc.invalidateQueries({ queryKey: ["summary", videoId] });
      onReady?.();
    }
  }, [data?.status, videoId, qc, onReady]);

  if (!data || data.status === "ready") return null;

  // For multi-chunk videos, status response includes { chunks: { ready, failed, total } }
  const chunks = (data as { chunks?: { ready: number; failed: number; total: number } })
    .chunks;
  const chunkProgress =
    chunks && chunks.total > 1
      ? ` · ${chunks.ready}/${chunks.total} parts ready`
      : "";
  const chunkPct =
    chunks && chunks.total > 0
      ? Math.max(20, Math.round((chunks.ready / chunks.total) * 100))
      : 60;

  const config = {
    indexing: {
      icon: <Loader2 className="h-5 w-5 animate-spin text-yellow-500" />,
      label: `Processing your lecture...${chunkProgress}`,
      detail:
        chunks && chunks.total > 1
          ? `Long lecture detected — split into ${chunks.total} parts. Each part is being indexed separately.`
          : "Twelve Labs is analyzing the video. This may take a few minutes.",
      progress: chunkPct,
    },
    pending: {
      icon: <Clock className="h-5 w-5 text-muted-foreground" />,
      label: "Waiting to process...",
      detail: "Your lecture is queued for processing.",
      progress: 20,
    },
    failed: {
      icon: <XCircle className="h-5 w-5 text-destructive" />,
      label: "Processing failed",
      detail: "There was an error processing this video. Please try again.",
      progress: 100,
    },
  }[data.status] ?? null;

  if (!config) return null;

  return (
    <div className="rounded-xl border bg-muted/30 p-5">
      <div className="flex items-start gap-3">
        {config.icon}
        <div className="flex-1">
          <p className="font-medium">{config.label}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{config.detail}</p>
          {data.status !== "failed" && (
            <Progress
              value={config.progress}
              className="mt-3 h-1.5"
            />
          )}
        </div>
      </div>
    </div>
  );
}
