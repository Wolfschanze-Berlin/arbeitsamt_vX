"use client";

import { useEffect, useRef } from "react";
import type { KanbanStore } from "@/lib/kanban/types";
import { kanbanSave } from "@/lib/kanban/store";

// ---------------------------------------------------------------------------
// Environment guard — mirrors isTauriEnvironment from lib/tauri.ts
// ---------------------------------------------------------------------------

function isTauriEnvironment(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Persists the KanbanStore to disk with an 800ms debounce on every store
 * change, and flushes immediately when the Tauri window is closed.
 *
 * Must be called inside KanbanProvider so it has access to the live store.
 */
export function useKanbanPersistence(store: KanbanStore): void {
  // Always hold a ref to the latest store so the close handler never captures
  // a stale snapshot via closure.
  const storeRef = useRef<KanbanStore>(store);

  useEffect(() => {
    storeRef.current = store;
  }, [store]);

  // Debounced save — fires 800ms after the last store change.
  useEffect(() => {
    const id = setTimeout(() => {
      kanbanSave(store).catch((err: unknown) => {
        console.error("[kanban] Debounced save failed:", err);
      });
    }, 800);

    return () => clearTimeout(id);
  }, [store]);

  // Flush on Tauri window close (mount-only).
  useEffect(() => {
    if (!isTauriEnvironment()) return;

    let unlisten: (() => void) | undefined;

    (async () => {
      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        const win = getCurrentWindow();

        unlisten = await win.onCloseRequested(async (event) => {
          event.preventDefault();
          try {
            await kanbanSave(storeRef.current);
          } catch (err: unknown) {
            console.error("[kanban] Close-flush save failed:", err);
          } finally {
            await win.destroy();
          }
        });
      } catch (err: unknown) {
        console.error("[kanban] Failed to register close handler:", err);
      }
    })();

    return () => {
      unlisten?.();
    };
  }, []);
}
