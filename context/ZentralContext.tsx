"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";

import type { ZentralProjectEntry } from "@/lib/zentral/types";
import {
  getProjects,
  upsertProject,
  removeProject,
} from "@/lib/zentral/store";

// --- Types ---

interface ZentralContextValue {
  projects: ZentralProjectEntry[];
  loading: boolean;
  addOrUpdateProject: (entry: ZentralProjectEntry) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  getProject: (id: string) => ZentralProjectEntry | undefined;
}

// --- Context ---

const ZentralContext = createContext<ZentralContextValue | null>(null);

// --- Provider ---

export function ZentralProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<ZentralProjectEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const all = await getProjects();
    setProjects(all);
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const addOrUpdateProject = useCallback(
    async (entry: ZentralProjectEntry) => {
      await upsertProject(entry);
      await refresh();
    },
    [refresh],
  );

  const deleteProject = useCallback(
    async (id: string) => {
      await removeProject(id);
      await refresh();
    },
    [refresh],
  );

  const getProject = useCallback(
    (id: string) => projects.find((p) => p.id === id),
    [projects],
  );

  return (
    <ZentralContext.Provider
      value={{ projects, loading, addOrUpdateProject, deleteProject, getProject }}
    >
      {children}
    </ZentralContext.Provider>
  );
}

// --- Hook ---

export function useZentral(): ZentralContextValue {
  const ctx = useContext(ZentralContext);
  if (!ctx) throw new Error("useZentral must be used within ZentralProvider");
  return ctx;
}
