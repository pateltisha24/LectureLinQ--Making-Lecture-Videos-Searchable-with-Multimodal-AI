import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import type { Video, VideoUploadForm } from "@/types";

const api = axios.create({ baseURL: "/api" });

export function useVideos() {
  return useQuery<Video[]>({
    queryKey: ["videos"],
    queryFn: async () => {
      const res = await api.get<{ data: Video[] }>("/videos");
      return res.data.data;
    },
  });
}

export function useVideo(id: string) {
  return useQuery<Video>({
    queryKey: ["video", id],
    queryFn: async () => {
      const res = await api.get<{ data: Video }>(`/videos/${id}`);
      return res.data.data;
    },
    enabled: !!id,
  });
}

export function useVideoStatus(id: string, enabled: boolean) {
  return useQuery({
    queryKey: ["video-status", id],
    queryFn: async () => {
      const res = await api.get<{ data: { status: string } }>(
        `/videos/${id}/status`
      );
      return res.data.data;
    },
    enabled: enabled && !!id,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === "indexing" || status === "pending") return 5000;
      return false;
    },
  });
}

export function useChapters(videoId: string) {
  return useQuery({
    queryKey: ["chapters", videoId],
    queryFn: async () => {
      const res = await api.get(`/videos/${videoId}/chapters`);
      return res.data.data;
    },
    enabled: !!videoId,
  });
}

export function useSummary(videoId: string) {
  return useQuery({
    queryKey: ["summary", videoId],
    queryFn: async () => {
      const res = await api.get(`/videos/${videoId}/summary`);
      return res.data.data;
    },
    enabled: !!videoId,
  });
}

export function useCreateVideo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<VideoUploadForm>) => {
      const res = await api.post<{ data: Video }>("/videos", data);
      return res.data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["videos"] }),
  });
}

export function useDeleteVideo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/videos/${id}`);
      return id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["videos"] }),
  });
}

export function useRegenerateChapters() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (videoId: string) => {
      const res = await api.post(`/videos/${videoId}/chapters`);
      return res.data.data;
    },
    onSuccess: (_data, videoId) =>
      qc.invalidateQueries({ queryKey: ["chapters", videoId] }),
  });
}

export function useRegenerateSummary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (videoId: string) => {
      const res = await api.post(`/videos/${videoId}/summary`);
      return res.data.data;
    },
    onSuccess: (_data, videoId) =>
      qc.invalidateQueries({ queryKey: ["summary", videoId] }),
  });
}

