"use client";

import type { UIMessage } from "ai";
import type { ChatMeta, ChatSession } from "./types";

type StoreInstance = {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
  save(): Promise<void>;
  delete(key: string): Promise<boolean>;
};

let storeInstance: StoreInstance | null = null;

const STORE_NAME = "chat-history.json";
const INDEX_KEY = "chat-index";

function chatKey(id: string): string {
  return `chat-${id}`;
}

async function getStore(): Promise<StoreInstance | null> {
  if (storeInstance) return storeInstance;
  if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) {
    return null;
  }
  const { LazyStore } = await import("@tauri-apps/plugin-store");
  storeInstance = new LazyStore(STORE_NAME);
  return storeInstance;
}

/** Generate a unique chat ID. */
export function createChatId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Load the list of all chat metadata entries. */
export async function loadAllChats(): Promise<ChatMeta[]> {
  const store = await getStore();
  if (!store) return [];
  return (await store.get<ChatMeta[]>(INDEX_KEY)) ?? [];
}

/** Load a single chat session by ID. */
export async function loadChat(id: string): Promise<ChatSession | null> {
  const store = await getStore();
  if (!store) return null;

  const index = (await store.get<ChatMeta[]>(INDEX_KEY)) ?? [];
  const meta = index.find((c) => c.id === id);
  if (!meta) return null;

  const messages = (await store.get<UIMessage[]>(chatKey(id))) ?? [];
  return { meta, messages };
}

/** Save (create or update) a chat session. */
export async function saveChat(session: ChatSession): Promise<void> {
  const store = await getStore();
  if (!store) return;

  const index = (await store.get<ChatMeta[]>(INDEX_KEY)) ?? [];
  const existing = index.findIndex((c) => c.id === session.meta.id);

  const updatedMeta = { ...session.meta, updatedAt: new Date().toISOString() };

  if (existing >= 0) {
    index[existing] = updatedMeta;
  } else {
    index.unshift(updatedMeta);
  }

  await store.set(INDEX_KEY, index);
  await store.set(chatKey(session.meta.id), session.messages);
  await store.save();
}

/** Delete a chat by ID. */
export async function deleteChat(id: string): Promise<void> {
  const store = await getStore();
  if (!store) return;

  const index = (await store.get<ChatMeta[]>(INDEX_KEY)) ?? [];
  const filtered = index.filter((c) => c.id !== id);

  await store.set(INDEX_KEY, filtered);
  await store.delete(chatKey(id));
  await store.save();
}
