"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useKanban } from "@/context/KanbanContext";

interface AddColumnButtonProps {
  /** boardId is required so the new column is scoped to the correct board. */
  boardId: string;
}

export function AddColumnButton({ boardId }: AddColumnButtonProps) {
  const { dispatch } = useKanban();
  const [isEditing, setIsEditing] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  function startEditing() {
    setIsEditing(true);
    // Focus is set after the input mounts via the effect below.
  }

  React.useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
    }
  }, [isEditing]);

  function commit() {
    const trimmed = title.trim();
    if (trimmed.length > 0) {
      dispatch({
        type: "ADD_COLUMN",
        payload: { boardId, title: trimmed },
      });
    }
    reset();
  }

  function reset() {
    setTitle("");
    setIsEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      reset();
    }
  }

  return (
    <div
      className={cn(
        "flex w-72 shrink-0 flex-col justify-start rounded-lg border-2 border-dashed",
        "border-border/60 transition-colors",
        isEditing ? "p-3" : "items-center p-4 hover:border-border cursor-pointer",
      )}
      onClick={!isEditing ? startEditing : undefined}
      role={!isEditing ? "button" : undefined}
      tabIndex={!isEditing ? 0 : undefined}
      onKeyDown={
        !isEditing
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                startEditing();
              }
            }
          : undefined
      }
      aria-label={!isEditing ? "Add column" : undefined}
    >
      {isEditing ? (
        <div className="flex flex-col gap-2">
          <Input
            ref={inputRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={commit}
            onKeyDown={handleKeyDown}
            placeholder="Column title..."
            className="h-8 text-sm"
          />
          <div className="flex gap-2">
            <Button size="sm" className="h-7 flex-1 text-xs" onClick={commit}>
              Add
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 flex-1 text-xs"
              onClick={reset}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-muted-foreground text-sm select-none">
          <Plus className="size-4" />
          <span>Add column</span>
        </div>
      )}
    </div>
  );
}
