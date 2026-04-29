"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Clock, Loader2, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useVideoStore } from "@/store/useVideoStore";
import { useAskQuestion } from "@/hooks/useQA";
import { formatTimestamp } from "@/lib/utils";
import type { QAMessage } from "@/types";
import { cn } from "@/lib/utils";

const SUGGESTED_QUESTIONS = [
  "What are the main topics covered in this lecture?",
  "Can you explain the key concepts?",
  "What are the most important takeaways?",
  "Are there any examples given in this lecture?",
];

interface QAInterfaceProps {
  videoId: string;
}

export function QAInterface({ videoId }: QAInterfaceProps) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { qaMessages, seekToTimestamp } = useVideoStore();
  const messages = qaMessages[videoId] ?? [];
  const { mutate: askQuestion, isPending } = useAskQuestion(videoId);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = input.trim();
    if (!q || isPending) return;
    setInput("");
    askQuestion(q);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <MessageCircle className="h-7 w-7 text-primary" />
            </div>
            <div>
              <p className="font-medium">Ask anything about this lecture</p>
              <p className="text-sm text-muted-foreground">
                Get instant answers with relevant timestamps
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => { setInput(q); }}
                  className="rounded-full border px-3 py-1.5 text-xs transition-colors hover:bg-muted"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                onSeek={seekToTimestamp}
              />
            ))}
            {isPending && <TypingIndicator />}
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="border-t p-3">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question about this lecture..."
            className="min-h-[44px] max-h-32 resize-none"
            rows={1}
          />
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || isPending}
            className="h-11 w-11 flex-shrink-0"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>
        <p className="mt-1.5 text-center text-xs text-muted-foreground">
          Press Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  onSeek,
}: {
  message: QAMessage;
  onSeek: (t: number) => void;
}) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full",
          isUser ? "bg-primary text-primary-foreground" : "bg-muted"
        )}
      >
        {isUser ? (
          <User className="h-4 w-4" />
        ) : (
          <Bot className="h-4 w-4 text-primary" />
        )}
      </div>

      <div className={cn("max-w-[80%] space-y-2", isUser && "items-end")}>
        <div
          className={cn(
            "rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
            isUser
              ? "rounded-tr-sm bg-primary text-primary-foreground"
              : "rounded-tl-sm bg-muted"
          )}
        >
          {message.content}
        </div>

        {!isUser && message.timestamps && message.timestamps.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {message.timestamps.map((t, i) => (
              <button
                key={i}
                onClick={() => onSeek(t)}
                className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary transition-colors hover:bg-primary/20"
              >
                <Clock className="h-2.5 w-2.5" />
                {formatTimestamp(t)}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-3">
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-muted">
        <Bot className="h-4 w-4 text-primary" />
      </div>
      <div className="flex items-center rounded-2xl rounded-tl-sm bg-muted px-4 py-3">
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
