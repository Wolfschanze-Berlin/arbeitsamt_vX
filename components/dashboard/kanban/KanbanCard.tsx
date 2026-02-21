"use client";

import * as React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CalendarDays, FileText, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PriorityBadge } from "@/components/dashboard/kanban/PriorityBadge";
import type { KanbanCard as KanbanCardType } from "@/lib/kanban/types";
import { resolveAttachmentUrl } from "@/lib/kanban/attachments";

// ---------------------------------------------------------------------------
// useAttachmentUrl — resolves a stored relative path to an asset:// URL
// ---------------------------------------------------------------------------

function useAttachmentUrl(relativePath: string | undefined): string | undefined {
  const [url, setUrl] = React.useState<string | undefined>(undefined);

  React.useEffect(() => {
    if (!relativePath) {
      setUrl(undefined);
      return;
    }

    let cancelled = false;

    resolveAttachmentUrl(relativePath)
      .then((resolved) => {
        if (!cancelled) setUrl(resolved || undefined);
      })
      .catch(() => {
        if (!cancelled) setUrl(undefined);
      });

    return () => {
      cancelled = true;
    };
  }, [relativePath]);

  return url;
}

// ---------------------------------------------------------------------------
// KanbanCardInner
// ---------------------------------------------------------------------------

interface KanbanCardProps {
  card: KanbanCardType;
  onEdit: (card: KanbanCardType) => void;
}

function KanbanCardInner({ card, onEdit }: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const coverUrl = useAttachmentUrl(card.coverImagePath);

  const formattedDueDate = card.dueDate
    ? new Date(card.dueDate).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "group relative flex flex-col gap-2 rounded-lg border bg-card p-3 shadow-sm",
        "cursor-grab active:cursor-grabbing select-none",
        "hover:border-primary/40 transition-colors",
        isDragging && "opacity-30 ring-2 ring-primary/40"
      )}
    >
      {/* Cover image — rendered only once the async URL is resolved */}
      {coverUrl && (
        <img
          src={coverUrl}
          alt=""
          draggable={false}
          className="w-full rounded-md object-cover max-h-32"
        />
      )}

      {/* Header row: title + edit button */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium leading-snug text-card-foreground">
          {card.title}
        </p>
        <Button
          variant="ghost"
          size="icon"
          className="size-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            onEdit(card);
          }}
          aria-label="Edit card"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <Pencil className="size-3" />
        </Button>
      </div>

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

const KanbanCard = React.memo(
  KanbanCardInner,
  (prev, next) => prev.card.id === next.card.id && prev.card === next.card
);

export { KanbanCard };
export type { KanbanCardProps };
