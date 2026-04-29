"use client";

import Link from "next/link";
import Image from "next/image";
import { Clock, Play, BookOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatTimestamp } from "@/lib/utils";
import type { SearchResult } from "@/types";

interface SearchResultsProps {
  results: SearchResult[];
  query: string;
}

export function SearchResults({ results, query }: SearchResultsProps) {
  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <BookOpen className="h-12 w-12 text-muted-foreground/30" />
        <div>
          <p className="font-medium">No results found</p>
          <p className="text-sm text-muted-foreground">
            Try different keywords or a broader query.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {results.length} result{results.length !== 1 ? "s" : ""} for{" "}
        <span className="font-medium text-foreground">"{query}"</span>
      </p>

      {results.map((result, i) => (
        <Link
          key={i}
          href={`/videos/${result.videoId}?t=${Math.floor(result.startTime)}`}
        >
          <Card className="flex gap-4 p-4 transition-shadow hover:shadow-md cursor-pointer">
            {/* Thumbnail / score */}
            <div className="relative h-20 w-32 flex-shrink-0 overflow-hidden rounded-lg bg-muted">
              {result.video?.thumbnailUrl ? (
                <Image
                  src={result.video.thumbnailUrl}
                  alt={result.video.title ?? ""}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <Play className="h-8 w-8 text-muted-foreground/30" />
                </div>
              )}
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity hover:opacity-100">
                <Play className="h-6 w-6 text-white" />
              </div>
            </div>

            {/* Content */}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">
                {result.video?.title ?? "Unknown Lecture"}
              </p>
              {result.text && (
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                  {result.text}
                </p>
              )}
              <div className="mt-2 flex items-center gap-2">
                <Badge variant="secondary" className="flex items-center gap-1 text-xs">
                  <Clock className="h-3 w-3" />
                  {formatTimestamp(result.startTime)}
                  {result.endTime && ` — ${formatTimestamp(result.endTime)}`}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {Math.round(result.score * 100)}% match
                </Badge>
              </div>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}
