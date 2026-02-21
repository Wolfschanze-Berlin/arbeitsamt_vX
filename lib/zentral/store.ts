"use client";

import type { ZentralProjectEntry } from "./types";

// --- Store Setup ---

type StoreInstance = {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
  save(): Promise<void>;
};

const STORE_NAME = "zentral.json";
const STORE_KEY = "zentral_projects";

let storeInstance: StoreInstance | null = null;

async function getStore(): Promise<StoreInstance | null> {
  if (storeInstance) return storeInstance;
  if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) {
    return null;
  }
  const { LazyStore } = await import("@tauri-apps/plugin-store");
  storeInstance = new LazyStore(STORE_NAME);
  return storeInstance;
}

async function readAll(store: StoreInstance): Promise<ZentralProjectEntry[]> {
  return (await store.get<ZentralProjectEntry[]>(STORE_KEY)) ?? [];
}

// --- Public API ---

/** Return all stored projects. */
export async function getProjects(): Promise<ZentralProjectEntry[]> {
  const store = await getStore();
  if (!store) return [];
  return readAll(store);
}

/** Return a single project by id, or null if not found. */
export async function getProject(
  id: string,
): Promise<ZentralProjectEntry | null> {
  const store = await getStore();
  if (!store) return null;
  const all = await readAll(store);
  return all.find((p) => p.id === id) ?? null;
}

/** Add or replace a project (upsert by id). */
export async function upsertProject(
  entry: ZentralProjectEntry,
): Promise<void> {
  const store = await getStore();
  if (!store) return;
  const all = await readAll(store);
  const idx = all.findIndex((p) => p.id === entry.id);
  if (idx >= 0) {
    all[idx] = entry;
  } else {
    all.push(entry);
  }
  await store.set(STORE_KEY, all);
  await store.save();
}

/** Remove a project by id. No-op if not found. */
export async function removeProject(id: string): Promise<void> {
  const store = await getStore();
  if (!store) return;
  const all = await readAll(store);
  const filtered = all.filter((p) => p.id !== id);
  if (filtered.length === all.length) return;
  await store.set(STORE_KEY, filtered);
  await store.save();
}
