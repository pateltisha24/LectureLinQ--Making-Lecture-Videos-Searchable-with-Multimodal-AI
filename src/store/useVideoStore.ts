import { create } from "zustand";
import type { QAMessage } from "@/types";

interface VideoPlayerState {
  currentTime: number;
  isPlaying: boolean;
  seekTo: number | null;
}

interface VideoStore {
  // Player
  player: VideoPlayerState;
  setCurrentTime: (t: number) => void;
  setIsPlaying: (playing: boolean) => void;
  seekToTimestamp: (t: number) => void;
  clearSeek: () => void;

  // Q&A per video
  qaMessages: Record<string, QAMessage[]>;
  addQAMessage: (videoId: string, msg: QAMessage) => void;
  clearQAMessages: (videoId: string) => void;

  // Search
  searchQuery: string;
  setSearchQuery: (q: string) => void;

  // Active video tab
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const useVideoStore = create<VideoStore>((set) => ({
  player: {
    currentTime: 0,
    isPlaying: false,
    seekTo: null,
  },
  setCurrentTime: (t) =>
    set((s) => ({ player: { ...s.player, currentTime: t } })),
  setIsPlaying: (playing) =>
    set((s) => ({ player: { ...s.player, isPlaying: playing } })),
  seekToTimestamp: (t) =>
    set((s) => ({ player: { ...s.player, seekTo: t } })),
  clearSeek: () =>
    set((s) => ({ player: { ...s.player, seekTo: null } })),

  qaMessages: {},
  addQAMessage: (videoId, msg) =>
    set((s) => ({
      qaMessages: {
        ...s.qaMessages,
        [videoId]: [...(s.qaMessages[videoId] ?? []), msg],
      },
    })),
  clearQAMessages: (videoId) =>
    set((s) => ({
      qaMessages: { ...s.qaMessages, [videoId]: [] },
    })),

  searchQuery: "",
  setSearchQuery: (q) => set({ searchQuery: q }),

  activeTab: "summary",
  setActiveTab: (tab) => set({ activeTab: tab }),
}));
