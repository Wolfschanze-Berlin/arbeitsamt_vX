"use client";

import { useEffect, useRef } from "react";
import type { UIMessage } from "ai";
import { cn } from "@/lib/utils";
import { ChatMessage } from "@/components/dashboard/chat/ChatMessage";

interface ChatMessageListProps {
  messages: UIMessage[];
  status: string;
}

function ChatMessageList({ messages, status }: ChatMessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change or during streaming
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  const isStreaming = status === "streaming";
  const isSubmitted = status === "submitted";

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto scroll-smooth"
    >
      <div className="mx-auto flex max-w-3xl flex-col py-4">
        {messages.length === 0 && (
          <EmptyState />
        )}

        {messages.map((message) => (
          <ChatMessage key={message.id} message={message} />
        ))}

        {isSubmitted && <TypingIndicator />}

        <div ref={bottomRef} className="h-px" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function EmptyState() {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-20">
      <p className="text-sm text-muted-foreground">
        Start a conversation by sending a message.
      </p>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted">
        <span className="sr-only">Assistant is thinking</span>
      </div>
      <div className="flex items-center gap-1">
        <span
          className={cn(
            "size-1.5 rounded-full bg-muted-foreground/60",
            "animate-pulse [animation-delay:0ms]"
          )}
        />
        <span
          className={cn(
            "size-1.5 rounded-full bg-muted-foreground/60",
            "animate-pulse [animation-delay:150ms]"
          )}
        />
        <span
          className={cn(
            "size-1.5 rounded-full bg-muted-foreground/60",
            "animate-pulse [animation-delay:300ms]"
          )}
        />
      </div>
    </div>
  );
}

export { ChatMessageList };
export type { ChatMessageListProps };
