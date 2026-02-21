"use client";

import type { UIMessage } from "ai";

/** Lightweight metadata for the chat list sidebar. */
export interface ChatMeta {
  id: string;
  title: string;
  provider: string;
  model: string;
  createdAt: string;
  updatedAt: string;
}

/** Full chat session: metadata + messages. */
export interface ChatSession {
  meta: ChatMeta;
  messages: UIMessage[];
}
