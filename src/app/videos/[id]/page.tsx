"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Clock, Loader2, FileText, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChapterList } from "@/components/video/ChapterList";
import { SummaryPanel } from "@/components/video/SummaryPanel";
import { QAInterface } from "@/components/video/QAInterface";
import { ProcessingStatus } from "@/components/video/ProcessingStatus";
import { useVideo, useChapters, useSummary } from "@/hooks/useVideos";
import { useVideoStore } from "@/store/useVideoStore";
import { formatDuration } from "@/lib/utils";

export default function VideoDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data: video, isLoading } = useVideo(id);
  const { data: chapters = [], isLoading: chaptersLoading } = useChapters(id);
  const { data: summary, isLoading: summaryLoading } = useSummary(id);
  const { activeTab, setActiveTab } = useVideoStore();

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!video) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <p className="font-medium">Lecture not found</p>
        <Link href="/videos">
          <Button className="mt-4">Back to Lectures</Button>
        </Link>
      </div>
    );
  }

  const isReady = video.status === "ready";

  return (
    <div className="container mx-auto max-w-5xl px-4 py-6">
      {/* Header */}
      <div className="mb-6 flex items-start gap-3">
        <Link href="/videos">
          <Button variant="ghost" size="icon" className="mt-0.5 h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold leading-tight">{video.title}</h1>
          <div className="mt-1.5 flex items-center gap-2">
            {video.duration && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {formatDuration(video.duration)}
              </span>
            )}
            <Badge
              variant={
                video.status === "ready"
                  ? "default"
                  : video.status === "failed"
                    ? "destructive"
                    : "secondary"
              }
              className="text-xs"
            >
              {video.status}
            </Badge>
          </div>
          {video.description && (
            <p className="mt-2 text-sm text-muted-foreground">{video.description}</p>
          )}
        </div>
      </div>

      {/* Processing status banner */}
      {!isReady && (
        <div className="mb-6">
          <ProcessingStatus videoId={id} />
        </div>
      )}

      {/* AI features as full-width tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="summary" className="gap-2">
            <FileText className="h-4 w-4" />
            Summary
          </TabsTrigger>
          <TabsTrigger value="chapters" className="gap-2">
            <Clock className="h-4 w-4" />
            Chapters
          </TabsTrigger>
          <TabsTrigger value="qa" className="gap-2">
            <Sparkles className="h-4 w-4" />
            Q&amp;A
          </TabsTrigger>
        </TabsList>

        <div className="mt-4 min-h-[400px] overflow-hidden rounded-xl border">
          <TabsContent value="summary" className="m-0">
            <SummaryPanel
              videoId={id}
              summary={summary ?? null}
              loading={summaryLoading}
            />
          </TabsContent>

          <TabsContent value="chapters" className="m-0">
            <ChapterList
              videoId={id}
              chapters={chapters}
              loading={chaptersLoading}
            />
          </TabsContent>

          <TabsContent value="qa" className="m-0">
            {isReady ? (
              <QAInterface videoId={id} />
            ) : (
              <div className="flex h-[400px] items-center justify-center p-8 text-center text-sm text-muted-foreground">
                Q&amp;A will be available once the video finishes processing.
              </div>
            )}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
