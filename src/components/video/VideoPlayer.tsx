"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Pause, Volume2, VolumeX, Maximize } from "lucide-react";
import { useVideoStore } from "@/store/useVideoStore";
import { formatDuration } from "@/lib/utils";

interface VideoPlayerProps {
  src: string;
}

export function VideoPlayer({ src }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);

  const { player, setCurrentTime, setIsPlaying, clearSeek } = useVideoStore();

  useEffect(() => {
    if (player.seekTo !== null && videoRef.current) {
      videoRef.current.currentTime = player.seekTo;
      videoRef.current.play();
      clearSeek();
    }
  }, [player.seekTo, clearSeek]);

  function handlePlayPause() {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
    } else {
      videoRef.current.pause();
    }
  }

  return (
    <div className="group relative overflow-hidden rounded-xl bg-black">
      <video
        ref={videoRef}
        src={src}
        className="w-full"
        onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime ?? 0)}
        onLoadedMetadata={() => setDuration(videoRef.current?.duration ?? 0)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onClick={handlePlayPause}
      />

      {/* Controls overlay */}
      <div className="absolute bottom-0 left-0 right-0 translate-y-full bg-gradient-to-t from-black/80 to-transparent p-4 transition-transform group-hover:translate-y-0">
        {/* Progress bar */}
        <input
          type="range"
          min={0}
          max={duration || 100}
          step={0.1}
          value={player.currentTime}
          onChange={(e) => {
            if (videoRef.current)
              videoRef.current.currentTime = Number(e.target.value);
          }}
          className="mb-3 w-full cursor-pointer accent-primary"
        />

        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button onClick={handlePlayPause} className="text-white hover:text-primary">
              {player.isPlaying ? (
                <Pause className="h-5 w-5" />
              ) : (
                <Play className="h-5 w-5" />
              )}
            </button>
            <button
              onClick={() => {
                setMuted(!muted);
                if (videoRef.current) videoRef.current.muted = !muted;
              }}
              className="text-white hover:text-primary"
            >
              {muted ? (
                <VolumeX className="h-4 w-4" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={(e) => {
                const v = Number(e.target.value);
                setVolume(v);
                setMuted(v === 0);
                if (videoRef.current) videoRef.current.volume = v;
              }}
              className="w-20 cursor-pointer accent-primary"
            />
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-white/80">
              {formatDuration(player.currentTime)} / {formatDuration(duration)}
            </span>
            <button
              onClick={() => videoRef.current?.requestFullscreen()}
              className="text-white hover:text-primary"
            >
              <Maximize className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
