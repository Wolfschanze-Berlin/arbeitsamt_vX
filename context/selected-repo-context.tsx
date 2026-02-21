"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { GithubRepo } from "@/lib/github";

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

type SelectedRepoContextValue = {
  selectedRepo: GithubRepo | null;
  setSelectedRepo: (repo: GithubRepo | null) => void;
};

const SelectedRepoContext = createContext<SelectedRepoContextValue | undefined>(
  undefined,
);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function SelectedRepoProvider({ children }: { children: ReactNode }) {
  const [selectedRepo, setSelectedRepo] = useState<GithubRepo | null>(null);

  return (
    <SelectedRepoContext.Provider value={{ selectedRepo, setSelectedRepo }}>
      {children}
    </SelectedRepoContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSelectedRepo(): SelectedRepoContextValue {
  const context = useContext(SelectedRepoContext);
  if (!context) {
    throw new Error(
      "useSelectedRepo must be used within a SelectedRepoProvider",
    );
  }
  return context;
}
