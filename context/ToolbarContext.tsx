"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import type { Status } from "@/lib/kanban/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SortField = "priority" | "dueDate" | "createdAt" | "title";

type ToolbarState = {
  activeTab: "all" | Status;
  searchQuery: string;
  sortField: SortField;
  sortDirection: "asc" | "desc";
};

type ToolbarContextValue = ToolbarState & {
  setActiveTab: (tab: "all" | Status) => void;
  setSearchQuery: (q: string) => void;
  setSortField: (f: SortField) => void;
  setSortDirection: (d: "asc" | "desc") => void;
  toggleSortDirection: () => void;
};

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const ToolbarContext = createContext<ToolbarContextValue | undefined>(undefined);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

const DEFAULT_STATE: ToolbarState = {
  activeTab: "all",
  searchQuery: "",
  sortField: "createdAt",
  sortDirection: "desc",
};

export function ToolbarProvider({ children }: { children: ReactNode }) {
  const [activeTab, setActiveTab] = useState<"all" | Status>(
    DEFAULT_STATE.activeTab
  );
  const [searchQuery, setSearchQuery] = useState<string>(
    DEFAULT_STATE.searchQuery
  );
  const [sortField, setSortField] = useState<SortField>(
    DEFAULT_STATE.sortField
  );
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">(
    DEFAULT_STATE.sortDirection
  );

  const toggleSortDirection = useCallback(() => {
    setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
  }, []);

  return (
    <ToolbarContext.Provider
      value={{
        activeTab,
        searchQuery,
        sortField,
        sortDirection,
        setActiveTab,
        setSearchQuery,
        setSortField,
        setSortDirection,
        toggleSortDirection,
      }}
    >
      {children}
    </ToolbarContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useToolbar(): ToolbarContextValue {
  const context = useContext(ToolbarContext);
  if (!context) {
    throw new Error("useToolbar must be used within a ToolbarProvider");
  }
  return context;
}
