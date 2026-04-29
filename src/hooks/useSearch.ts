import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import type { SearchResult } from "@/types";

export function useSemanticSearch() {
  return useMutation({
    mutationFn: async ({
      query,
      videoIds,
    }: {
      query: string;
      videoIds?: string[];
    }) => {
      const res = await axios.post<{ data: SearchResult[] }>("/api/search", {
        query,
        videoIds,
      });
      return res.data.data;
    },
  });
}
