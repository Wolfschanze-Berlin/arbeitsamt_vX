"use client";

import * as React from "react";
import { useDeferredValue } from "react";
import { ArrowDown, ArrowUp, Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useKanban } from "@/context/KanbanContext";
import { useToolbar } from "@/context/ToolbarContext";
import type { Status } from "@/lib/kanban/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type KanbanToolbarProps = {
  onAddTask: () => void;
};

// ---------------------------------------------------------------------------
// Tab config
// ---------------------------------------------------------------------------

type TabEntry = {
  value: "all" | Status;
  label: string;
};

const TAB_ENTRIES: TabEntry[] = [
  { value: "all", label: "All" },
  { value: "todo", label: "To Do" },
  { value: "in_progress", label: "In Progress" },
  { value: "done", label: "Done" },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function KanbanToolbar({ onAddTask }: KanbanToolbarProps) {
  const { store } = useKanban();
  const {
    activeTab,
    searchQuery,
    sortField,
    sortDirection,
    setActiveTab,
    setSearchQuery,
    setSortField,
    toggleSortDirection,
  } = useToolbar();

  const [inputValue, setInputValue] = React.useState(searchQuery);
  const deferredInput = useDeferredValue(inputValue);

  React.useEffect(() => {
    setSearchQuery(deferredInput);
  }, [deferredInput, setSearchQuery]);

  const countForTab = React.useCallback(
    (tab: "all" | Status): number => {
      if (tab === "all") return store.cards.length;
      return store.cards.filter((c) => c.status === tab).length;
    },
    [store.cards]
  );

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 px-4 py-3",
        "border-b border-border bg-background"
      )}
    >
      {/* Tab row */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as "all" | Status)}
      >
        <TabsList>
          {TAB_ENTRIES.map(({ value, label }) => (
            <TabsTrigger key={value} value={value}>
              {label}
              <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
                {countForTab(value)}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="h-9 w-48 pl-8 sm:w-56"
          placeholder="Search tasks..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
        />
      </div>

      {/* Sort field */}
      <Select
        value={sortField}
        onValueChange={(v) =>
          setSortField(
            v as "priority" | "dueDate" | "createdAt" | "title"
          )
        }
      >
        <SelectTrigger size="sm" className="w-36">
          <SelectValue placeholder="Sort by" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="createdAt">Created</SelectItem>
          <SelectItem value="dueDate">Due Date</SelectItem>
          <SelectItem value="priority">Priority</SelectItem>
          <SelectItem value="title">Title</SelectItem>
        </SelectContent>
      </Select>

      {/* Sort direction toggle */}
      <Button
        variant="outline"
        size="icon"
        className="size-9 shrink-0"
        onClick={toggleSortDirection}
        aria-label={
          sortDirection === "asc" ? "Sort ascending" : "Sort descending"
        }
      >
        {sortDirection === "asc" ? (
          <ArrowUp className="size-4" />
        ) : (
          <ArrowDown className="size-4" />
        )}
      </Button>

      {/* Add task */}
      <Button size="sm" onClick={onAddTask}>
        <Plus className="size-4" />
        Add Task
      </Button>
    </div>
  );
}
