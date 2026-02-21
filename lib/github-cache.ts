/**
 * Cold-start persistence layer for GitHub API responses.
 *
 * Uses @tauri-apps/plugin-store for disk-backed caching with
 * per-key TTLs. Lazy-imports the store to avoid import-timing
 * crashes in Next.js dev (same pattern as lib/tauri.ts).
 */

const STORE_FILE = "github-cache.json";
const MAX_ENTRY_BYTES = 500_000;

const CACHE_TTL: Record<string, number> = {
  profile: 300,
  repos: 120,
  activity: 60,
  orgs: 600,
};

const DEFAULT_TTL = 120;

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

function isTauriEnvironment(): boolean {
  return (
    typeof window !== "undefined" && "__TAURI_INTERNALS__" in window
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Store type resolved at runtime
let storeInstance: { get: <T>(key: string) => Promise<T | undefined>; set: (key: string, value: unknown) => Promise<void>; delete: (key: string) => Promise<boolean>; clear: () => Promise<void>; save: () => Promise<void> } | null = null;

async function getStore(): Promise<typeof storeInstance> {
  if (!isTauriEnvironment()) return null;
  if (storeInstance) return storeInstance;

  const { load } = await import("@tauri-apps/plugin-store");
  storeInstance = await load(STORE_FILE);
  return storeInstance;
}

function ttlForKey(key: string): number {
  const prefix = key.split(":")[0] ?? key;
  return CACHE_TTL[prefix] ?? DEFAULT_TTL;
}

/**
 * Persist a GitHub API response to disk with a timestamp.
 * Silently skips if the payload exceeds 500 KB or Tauri is unavailable.
 */
export async function saveCache(key: string, data: unknown): Promise<void> {
  const json = JSON.stringify(data);
  if (json.length > MAX_ENTRY_BYTES) return;

  const store = await getStore();
  if (!store) return;

  const entry: CacheEntry<unknown> = { data, timestamp: Date.now() };
  await store.set(key, entry);
  await store.save();
}

/**
 * Load a cached GitHub API response if it exists and has not expired.
 * Returns `null` when Tauri is unavailable, the key is missing, or the TTL has elapsed.
 */
export async function loadCache<T>(key: string): Promise<T | null> {
  const store = await getStore();
  if (!store) return null;

  const entry = await store.get<CacheEntry<T>>(key);
  if (!entry) return null;

  const ttl = ttlForKey(key);
  if (Date.now() - entry.timestamp > ttl * 1000) {
    await store.delete(key);
    await store.save();
    return null;
  }

  return entry.data;
}

/**
 * Wipe all cached GitHub data. Intended for logout or settings reset.
 */
export async function clearCache(): Promise<void> {
  const store = await getStore();
  if (!store) return;

  await store.clear();
  await store.save();
  storeInstance = null;
}
