"use client";

import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
  type Dispatch,
} from "react";
import type { KanbanStore, KanbanCard, KanbanAction } from "@/lib/kanban/types";
import { kanbanReducer } from "@/lib/kanban/reducer";
import { kanbanLoadSafe } from "@/lib/kanban/store";
import { DEFAULT_STORE } from "@/lib/kanban/seed";
import { useKanbanPersistence } from "@/hooks/useKanbanPersistence";

// ---------------------------------------------------------------------------
// Context shape
// ---------------------------------------------------------------------------

type KanbanContextValue = {
  store: KanbanStore;
  dispatch: Dispatch<KanbanAction>;
  cardsByColumn: Map<string, KanbanCard[]>;
  isLoading: boolean;
  error: string | null;
};

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const KanbanContext = createContext<KanbanContextValue | undefined>(undefined);

// ---------------------------------------------------------------------------
// Skeleton loader
// ---------------------------------------------------------------------------

function KanbanSkeleton() {
  return (
    <div className="flex gap-4 p-6 animate-pulse">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex flex-col gap-3 w-64 shrink-0">
          <div className="h-6 rounded bg-zinc-200 dark:bg-zinc-700 w-3/4" />
          {[0, 1, 2].map((j) => (
            <div
              key={j}
              className="h-20 rounded-lg bg-zinc-100 dark:bg-zinc-800"
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function KanbanProvider({ children }: { children: ReactNode }) {
  const [store, dispatch] = useReducer(kanbanReducer, DEFAULT_STORE);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    kanbanLoadSafe()
      .then((loaded) => {
        if (cancelled) return;
        dispatch({ type: "RESTORE_SNAPSHOT", payload: loaded });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : "Failed to load kanban store";
        setError(message);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useKanbanPersistence(store);

  const cardsByColumn = useMemo<Map<string, KanbanCard[]>>(() => {
    const map = new Map<string, KanbanCard[]>();

    for (const column of store.columns) {
      map.set(column.id, []);
    }

    for (const card of store.cards) {
      const bucket = map.get(card.columnId);
      if (bucket) {
        bucket.push(card);
      } else {
        map.set(card.columnId, [card]);
      }
    }

    for (const [columnId, cards] of map) {
      map.set(columnId, [...cards].sort((a, b) => a.position - b.position));
    }

    return map;
  }, [store.cards, store.columns]);

  if (isLoading) {
    return <KanbanSkeleton />;
  }

  return (
    <KanbanContext.Provider value={{ store, dispatch, cardsByColumn, isLoading, error }}>
      {children}
    </KanbanContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useKanban(): KanbanContextValue {
  const context = useContext(KanbanContext);
  if (!context) {
    throw new Error("useKanban must be used within a KanbanProvider");
  }
  return context;
}
