/**
 * Safe Tauri API wrapper with lazy-loading.
 *
 * Prevents import-timing crashes when Next.js dev server
 * runs in a Node.js context where `window.__TAURI__` is undefined.
 * All Tauri API imports are deferred until runtime in the browser.
 */

function isTauriEnvironment(): boolean {
  return (
    typeof window !== "undefined" && "__TAURI_INTERNALS__" in window
  );
}

/**
 * Invoke a Tauri command safely.
 * Lazy-loads `@tauri-apps/api/core` on first call.
 */
export async function tauriInvoke<T>(
  cmd: string,
  args?: Record<string, unknown>
): Promise<T> {
  if (!isTauriEnvironment()) {
    throw new Error(
      `Cannot invoke Tauri command "${cmd}": not running in a Tauri webview.`
    );
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}

/**
 * Listen to a Tauri event safely.
 * Lazy-loads `@tauri-apps/api/event` on first call.
 */
export async function tauriListen<T>(
  event: string,
  handler: (payload: T) => void
): Promise<() => void> {
  if (!isTauriEnvironment()) {
    return () => {};
  }
  const { listen } = await import("@tauri-apps/api/event");
  const unlisten = await listen<T>(event, (e) => handler(e.payload));
  return unlisten;
}

/**
 * Emit a Tauri event safely.
 * Lazy-loads `@tauri-apps/api/event` on first call.
 */
export async function tauriEmit(
  event: string,
  payload?: unknown
): Promise<void> {
  if (!isTauriEnvironment()) {
    return;
  }
  const { emit } = await import("@tauri-apps/api/event");
  await emit(event, payload);
}
