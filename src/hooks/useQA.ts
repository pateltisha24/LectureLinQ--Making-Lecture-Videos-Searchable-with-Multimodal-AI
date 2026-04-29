import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import { useVideoStore } from "@/store/useVideoStore";
import type { QAMessage } from "@/types";
import { createId } from "@paralleldrive/cuid2";

export function useAskQuestion(videoId: string) {
  const { addQAMessage } = useVideoStore();

  return useMutation({
    mutationFn: async (question: string) => {
      // Optimistically add the user message
      const userMsg: QAMessage = {
        id: createId(),
        role: "user",
        content: question,
        createdAt: new Date().toISOString(),
      };
      addQAMessage(videoId, userMsg);

      const res = await axios.post<{ data: QAMessage }>(
        `/api/videos/${videoId}/qa`,
        { question }
      );
      return res.data.data;
    },
    onSuccess: (data) => {
      addQAMessage(videoId, data);
    },
  });
}
