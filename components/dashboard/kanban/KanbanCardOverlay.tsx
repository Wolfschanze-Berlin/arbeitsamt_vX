"use client";

import * as React from "react";
import { CalendarDays, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { PriorityBadge } from "@/components/dashboard/kanban/PriorityBadge";
import type { KanbanCard } from "@/lib/kanban/types";

interface KanbanCardOverlayProps {
  card: KanbanCard;
}

function KanbanCardOverlay({ card }: KanbanCardOverlayProps) {
  const formattedDueDate = card.dueDate
    ? new Date(card.dueDate).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-lg border bg-card p-3",
        "shadow-2xl ring-2 ring-primary/40 rotate-[1.5deg]",
        "select-none pointer-events-none"
      )}
    >
      {/* Cover image */}
      {card.coverImagePath && (
        <img
          src={card.coverImagePath}
          alt=""
          draggable={false}
          className="w-full rounded-md object-cover max-h-32"
        />
      )}

      {/* Title */}
      <p className="text-sm font-medium leading-snug text-card-foreground">
        {card.title}
      </p>

      {/* Priority badge */}
      <PriorityBadge priority={card.priority} />

      {/* Tags */}
      {card.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {card.tags.map((tag) => (
            <Badge key={tag} variant="outline" className="text-xs px-1.5 py-0">
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {/* Footer: due date + notes indicator */}
      {(formattedDueDate || card.notes) && (
        <div className="flex items-center gap-3 text-muted-foreground">
          {formattedDueDate && (
            <span className="flex items-center gap-1 text-xs">
              <CalendarDays className="size-3" />
              {formattedDueDate}
            </span>
          )}
          {card.notes && (
            <span className="flex items-center gap-1 text-xs" aria-label="Has notes">
              <FileText className="size-3" />
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export { KanbanCardOverlay };
export type { KanbanCardOverlayProps };
