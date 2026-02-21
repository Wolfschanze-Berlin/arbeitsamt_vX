"use client";

import * as React from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useKanban } from "@/context/KanbanContext";
import type { KanbanColumn } from "@/lib/kanban/types";

interface DeleteColumnDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  column: KanbanColumn;
}

export function DeleteColumnDialog({
  open,
  onOpenChange,
  column,
}: DeleteColumnDialogProps) {
  const { store, dispatch, cardsByColumn } = useKanban();
  const [moveToId, setMoveToId] = React.useState<string>("");

  // Columns on the same board, excluding the one being deleted.
  const otherColumns = store.columns.filter(
    (col) => col.boardId === column.boardId && col.id !== column.id,
  );

  const cardsInColumn = cardsByColumn.get(column.id) ?? [];
  const hasCards = cardsInColumn.length > 0;

  // Reset the target column selection whenever the dialog opens.
  React.useEffect(() => {
    if (open) {
      setMoveToId(otherColumns[0]?.id ?? "");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function handleDeleteWithCards() {
    dispatch({ type: "DELETE_COLUMN", payload: { columnId: column.id } });
    onOpenChange(false);
  }

  function handleMoveAndDelete() {
    if (!moveToId) return;

    const targetCards = cardsByColumn.get(moveToId) ?? [];
    const basePosition = targetCards.length;

    cardsInColumn.forEach((card, index) => {
      dispatch({
        type: "MOVE_CARD_CROSS_COLUMN",
        payload: {
          cardId: card.id,
          fromColumnId: column.id,
          toColumnId: moveToId,
          toPosition: basePosition + index,
        },
      });
    });

    dispatch({ type: "DELETE_COLUMN", payload: { columnId: column.id } });
    onOpenChange(false);
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete &quot;{column.title}&quot;?</AlertDialogTitle>
          <AlertDialogDescription>
            {hasCards
              ? `This column has ${cardsInColumn.length} card${cardsInColumn.length === 1 ? "" : "s"}. Choose how to proceed.`
              : "This column is empty. This action cannot be undone."}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {hasCards && otherColumns.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="move-to-select"
              className="text-sm font-medium text-foreground"
            >
              Move cards to
            </label>
            <Select value={moveToId} onValueChange={setMoveToId}>
              <SelectTrigger id="move-to-select" className="w-full">
                <SelectValue placeholder="Select a column" />
              </SelectTrigger>
              <SelectContent>
                {otherColumns.map((col) => (
                  <SelectItem key={col.id} value={col.id}>
                    {col.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>

          {hasCards && otherColumns.length > 0 && (
            <Button
              variant="default"
              onClick={handleMoveAndDelete}
              disabled={!moveToId}
            >
              Move &amp; delete
            </Button>
          )}

          <Button variant="destructive" onClick={handleDeleteWithCards}>
            Delete with all cards
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
