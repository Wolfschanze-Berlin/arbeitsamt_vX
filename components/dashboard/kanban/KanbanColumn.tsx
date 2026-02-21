"use client";

import * as React from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { MoreHorizontal, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { KanbanCard } from "@/components/dashboard/kanban/KanbanCard";
import { ColumnHeaderEditable } from "@/components/dashboard/kanban/ColumnHeaderEditable";
import { DeleteColumnDialog } from "@/components/dashboard/kanban/DeleteColumnDialog";
import type { KanbanCard as KanbanCardType, KanbanColumn } from "@/lib/kanban/types";

interface KanbanColumnProps {
  column: KanbanColumn;
  cards: KanbanCardType[];
  onEditCard: (card: KanbanCardType) => void;
  onAddCard: (columnId: string) => void;
}

function KanbanColumnInner({
  column,
  cards,
  onEditCard,
  onAddCard,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: { type: "column", columnId: column.id },
  });

  const [deleteOpen, setDeleteOpen] = React.useState(false);

  const cardIds = React.useMemo(() => cards.map((c) => c.id), [cards]);

  return (
    <div className="flex w-72 shrink-0 flex-col gap-2">
      {/* Column header */}
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2 min-w-0">
          <ColumnHeaderEditable column={column} />
          <Badge variant="secondary" className="shrink-0 tabular-nums">
            {cards.length}
          </Badge>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => onAddCard(column.id)}
            aria-label="Add card"
          >
            <Plus className="size-4" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                aria-label="Column options"
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => setDeleteOpen(true)}
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Drop zone + card list */}
      <ScrollArea
        className={cn(
          "rounded-lg border bg-muted/30 transition-colors",
          isOver && "bg-muted/60 ring-2 ring-primary/20"
        )}
      >
        <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
          <div
            ref={setNodeRef}
            className={cn(
              "flex flex-col gap-2 p-2",
              cards.length === 0 && "min-h-[80px]"
            )}
          >
            {cards.map((card) => (
              <KanbanCard key={card.id} card={card} onEdit={onEditCard} />
            ))}
          </div>
        </SortableContext>
      </ScrollArea>

      <DeleteColumnDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        column={column}
      />
    </div>
  );
}

const KanbanColumn = React.memo(KanbanColumnInner);

export { KanbanColumn };
export type { KanbanColumnProps };
