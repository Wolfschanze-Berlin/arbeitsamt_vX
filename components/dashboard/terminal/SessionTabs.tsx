"use client";

import { useCallback, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SessionType = "ssh" | "local";

export interface SessionTab {
  id: string;
  type: SessionType;
  label: string;
  color?: string;
}

interface SessionTabsProps {
  tabs: SessionTab[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onAdd: () => void;
  onReorder: (tabs: SessionTab[]) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Deterministic hash-based color when no explicit color is provided. */
function hashColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 55%, 55%)`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function SessionTabs({
  tabs,
  activeId,
  onSelect,
  onClose,
  onAdd,
  onReorder,
}: SessionTabsProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const dragNodeRef = useRef<HTMLButtonElement | null>(null);

  // ---- Drag handlers ----

  const handleDragStart = useCallback(
    (index: number, e: React.DragEvent<HTMLButtonElement>) => {
      setDragIndex(index);
      dragNodeRef.current = e.currentTarget;
      e.dataTransfer.effectAllowed = "move";
      // Required for Firefox
      e.dataTransfer.setData("text/plain", String(index));
    },
    [],
  );

  const handleDragOver = useCallback(
    (index: number, e: React.DragEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (dragIndex !== null && dragIndex !== index) {
        setDropIndex(index);
      }
    },
    [dragIndex],
  );

  const handleDrop = useCallback(
    (index: number, e: React.DragEvent<HTMLButtonElement>) => {
      e.preventDefault();
      if (dragIndex === null || dragIndex === index) return;

      const reordered = [...tabs];
      const [moved] = reordered.splice(dragIndex, 1);
      reordered.splice(index, 0, moved);
      onReorder(reordered);

      setDragIndex(null);
      setDropIndex(null);
    },
    [dragIndex, tabs, onReorder],
  );

  const handleDragEnd = useCallback(() => {
    setDragIndex(null);
    setDropIndex(null);
  }, []);

  // ---- Render ----

  return (
    <div
      className={cn(
        "flex h-9 items-center gap-0.5 overflow-x-auto px-1",
        "border-b border-border bg-muted/40 dark:bg-muted/20",
      )}
      role="tablist"
      aria-label="Terminal sessions"
    >
      {tabs.map((tab, index) => {
        const isActive = tab.id === activeId;
        const isDragging = dragIndex === index;
        const isDropTarget = dropIndex === index;
        const tabColor = tab.color ?? hashColor(tab.label);

        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            draggable
            onDragStart={(e) => handleDragStart(index, e)}
            onDragOver={(e) => handleDragOver(index, e)}
            onDrop={(e) => handleDrop(index, e)}
            onDragEnd={handleDragEnd}
            onClick={() => onSelect(tab.id)}
            className={cn(
              "group relative flex h-7 max-w-48 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-xs transition-colors select-none",
              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              isActive
                ? "bg-background text-foreground shadow-sm dark:bg-background"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
              isDragging && "opacity-50",
              isDropTarget && "ring-1 ring-primary/50",
            )}
          >
            {/* Color indicator dot */}
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: tabColor }}
              aria-hidden
            />

            {/* Label */}
            <span className="truncate">{tab.label}</span>

            {/* Type badge */}
            <span
              className={cn(
                "shrink-0 rounded px-1 py-px text-[10px] font-medium uppercase leading-none",
                "bg-muted text-muted-foreground",
                isActive && "bg-muted/80 dark:bg-muted",
              )}
            >
              {tab.type}
            </span>

            {/* Close button */}
            <span
              role="button"
              tabIndex={0}
              aria-label={`Close ${tab.label}`}
              onClick={(e) => {
                e.stopPropagation();
                onClose(tab.id);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.stopPropagation();
                  onClose(tab.id);
                }
              }}
              className={cn(
                "ml-auto flex size-4 shrink-0 items-center justify-center rounded-sm",
                "opacity-0 transition-opacity group-hover:opacity-100",
                isActive && "opacity-60",
                "hover:bg-destructive/20 hover:text-destructive",
              )}
            >
              <X className="size-3" />
            </span>
          </button>
        );
      })}

      {/* Add tab button */}
      <button
        type="button"
        aria-label="New session"
        onClick={onAdd}
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors",
          "hover:bg-muted hover:text-foreground",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        )}
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}

export { SessionTabs };
export type { SessionTabsProps };
