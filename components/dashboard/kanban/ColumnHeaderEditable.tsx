"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { useKanban } from "@/context/KanbanContext";
import type { KanbanColumn } from "@/lib/kanban/types";

interface ColumnHeaderEditableProps {
  column: KanbanColumn;
}

export function ColumnHeaderEditable({ column }: ColumnHeaderEditableProps) {
  const { dispatch } = useKanban();
  const [isEditing, setIsEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(column.title);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Keep draft in sync when the column title changes externally.
  React.useEffect(() => {
    if (!isEditing) {
      setDraft(column.title);
    }
  }, [column.title, isEditing]);

  function startEditing() {
    setDraft(column.title);
    setIsEditing(true);
  }

  React.useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  function commit() {
    const trimmed = draft.trim();
    if (trimmed.length > 0 && trimmed !== column.title) {
      dispatch({
        type: "RENAME_COLUMN",
        payload: { columnId: column.id, title: trimmed },
      });
    }
    setIsEditing(false);
  }

  function cancel() {
    setDraft(column.title);
    setIsEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancel();
    }
  }

  if (isEditing) {
    return (
      <Input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        className="h-7 px-1.5 py-0 text-sm font-semibold"
        aria-label="Rename column"
      />
    );
  }

  return (
    <h3
      className="truncate text-sm font-semibold text-foreground cursor-default select-none"
      onDoubleClick={startEditing}
      title="Double-click to rename"
    >
      {column.title}
    </h3>
  );
}
