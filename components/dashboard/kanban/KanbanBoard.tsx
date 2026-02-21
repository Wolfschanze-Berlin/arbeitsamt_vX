"use client";

import * as React from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { KanbanColumn } from "@/components/dashboard/kanban/KanbanColumn";
import { KanbanCardOverlay } from "@/components/dashboard/kanban/KanbanCardOverlay";
import { KanbanToolbar } from "@/components/dashboard/kanban/KanbanToolbar";
import { AddColumnButton } from "@/components/dashboard/kanban/AddColumnButton";
import { KanbanProvider, useKanban } from "@/context/KanbanContext";
import { ToolbarProvider, useToolbar } from "@/context/ToolbarContext";
import type { KanbanCard, KanbanStore, Priority } from "@/lib/kanban/types";

// ---------------------------------------------------------------------------
// Priority sort order
// ---------------------------------------------------------------------------

const PRIORITY_ORDER: Record<Priority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

// ---------------------------------------------------------------------------
// Dialog state
// ---------------------------------------------------------------------------

type DialogMode = "create" | "edit";

interface DialogState {
  open: boolean;
  mode: DialogMode;
  card?: KanbanCard;
  columnId?: string;
}

const CLOSED_DIALOG: DialogState = { open: false, mode: "create" };

// ---------------------------------------------------------------------------
// KanbanBoard — inner component, consumes KanbanContext + ToolbarContext
// ---------------------------------------------------------------------------

export function KanbanBoard(): React.ReactElement {
  const { store, dispatch, cardsByColumn } = useKanban();
  const { activeTab, searchQuery, sortField, sortDirection } = useToolbar();

  // Dialog
  const [dialogState, setDialogState] = React.useState<DialogState>(CLOSED_DIALOG);

  // Drag refs — mutable, not used for rendering
  const activeCardIdRef = React.useRef<string | null>(null);
  const preDragStateRef = React.useRef<KanbanStore | null>(null);

  // Reactive active card id — drives DragOverlay re-renders
  const [activeCardId, setActiveCardId] = React.useState<string | null>(null);

  // Sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Derive the active card for the overlay
  const activeCard = React.useMemo<KanbanCard | undefined>(
    () => (activeCardId ? store.cards.find((c) => c.id === activeCardId) : undefined),
    [activeCardId, store.cards],
  );

  // ---------------------------------------------------------------------------
  // Filtered + sorted cards (ephemeral — never persisted)
  // ---------------------------------------------------------------------------

  const filteredCards = React.useMemo<KanbanCard[]>(() => {
    const q = searchQuery.trim().toLowerCase();

    let cards = store.cards.filter((card) => {
      // Tab filter
      if (activeTab !== "all" && card.status !== activeTab) return false;

      // Search filter
      if (q) {
        const inTitle = card.title.toLowerCase().includes(q);
        const inDescription = card.description.toLowerCase().includes(q);
        const inTags = card.tags.some((t) => t.toLowerCase().includes(q));
        if (!inTitle && !inDescription && !inTags) return false;
      }

      return true;
    });

    // Sort
    cards = [...cards].sort((a, b) => {
      let cmp = 0;

      switch (sortField) {
        case "priority":
          cmp = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
          break;
        case "dueDate": {
          const aTime = a.dueDate ? a.dueDate.getTime() : Infinity;
          const bTime = b.dueDate ? b.dueDate.getTime() : Infinity;
          cmp = aTime - bTime;
          break;
        }
        case "title":
          cmp = a.title.localeCompare(b.title);
          break;
        case "createdAt":
        default:
          cmp = a.createdAt.getTime() - b.createdAt.getTime();
          break;
      }

      return sortDirection === "asc" ? cmp : -cmp;
    });

    return cards;
  }, [store.cards, activeTab, searchQuery, sortField, sortDirection]);

  // Map filtered cards by column for rendering
  const filteredCardsByColumn = React.useMemo<Map<string, KanbanCard[]>>(() => {
    const map = new Map<string, KanbanCard[]>();

    for (const column of store.columns) {
      map.set(column.id, []);
    }

    for (const card of filteredCards) {
      const bucket = map.get(card.columnId);
      if (bucket) {
        bucket.push(card);
      } else {
        map.set(card.columnId, [card]);
      }
    }

    return map;
  }, [filteredCards, store.columns]);

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  const handleDragStart = React.useCallback(
    (event: DragStartEvent) => {
      const id = event.active.id as string;
      activeCardIdRef.current = id;
      preDragStateRef.current = store;
      setActiveCardId(id);
    },
    [store],
  );

  const handleDragOver = React.useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event;
      if (!over) return;

      const cardId = active.id as string;
      const draggingCard = store.cards.find((c) => c.id === cardId);
      if (!draggingCard) return;

      const overData = over.data.current as Record<string, unknown> | undefined;

      let toColumnId: string;

      if (overData && overData["type"] === "column" && typeof overData["columnId"] === "string") {
        toColumnId = overData["columnId"];
      } else if (
        overData &&
        typeof overData["sortable"] === "object" &&
        overData["sortable"] !== null &&
        typeof (overData["sortable"] as Record<string, unknown>)["containerId"] === "string"
      ) {
        toColumnId = (overData["sortable"] as Record<string, unknown>)["containerId"] as string;
      } else {
        const isColumnId = store.columns.some((col) => col.id === (over.id as string));
        if (isColumnId) {
          toColumnId = over.id as string;
        } else {
          const overCard = store.cards.find((c) => c.id === (over.id as string));
          if (!overCard) return;
          toColumnId = overCard.columnId;
        }
      }

      if (toColumnId === draggingCard.columnId) return;

      // Use raw cardsByColumn for DnD position calculations (not filtered)
      const targetCards = cardsByColumn.get(toColumnId) ?? [];
      const toPosition = targetCards.length;

      dispatch({
        type: "MOVE_CARD_CROSS_COLUMN",
        payload: {
          cardId,
          fromColumnId: draggingCard.columnId,
          toColumnId,
          toPosition,
        },
      });
    },
    [store.cards, store.columns, cardsByColumn, dispatch],
  );

  const handleDragEnd = React.useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      activeCardIdRef.current = null;
      preDragStateRef.current = null;
      setActiveCardId(null);

      if (!over) return;

      const cardId = active.id as string;
      const draggingCard = store.cards.find((c) => c.id === cardId);
      if (!draggingCard) return;

      const overId = over.id as string;

      // Use raw cardsByColumn for DnD position calculations (not filtered)
      const overCard = store.cards.find((c) => c.id === overId);
      const overIsColumn = store.columns.some((col) => col.id === overId);

      let toColumnId: string;
      let toPosition: number;

      if (overIsColumn) {
        toColumnId = overId;
        toPosition = (cardsByColumn.get(toColumnId) ?? []).length;
      } else if (overCard) {
        toColumnId = overCard.columnId;
        toPosition = overCard.position;
      } else {
        return;
      }

      if (toColumnId === draggingCard.columnId) {
        if (toPosition !== draggingCard.position) {
          dispatch({
            type: "MOVE_CARD_SAME_COLUMN",
            payload: { columnId: toColumnId, cardId, toPosition },
          });
        }
      } else {
        dispatch({
          type: "MOVE_CARD_CROSS_COLUMN",
          payload: {
            cardId,
            fromColumnId: draggingCard.columnId,
            toColumnId,
            toPosition,
          },
        });
      }
    },
    [store.cards, store.columns, cardsByColumn, dispatch],
  );

  const handleDragCancel = React.useCallback(() => {
    if (preDragStateRef.current) {
      dispatch({ type: "RESTORE_SNAPSHOT", payload: preDragStateRef.current });
    }
    activeCardIdRef.current = null;
    preDragStateRef.current = null;
    setActiveCardId(null);
  }, [dispatch]);

  // -------------------------------------------------------------------------
  // Column callbacks
  // -------------------------------------------------------------------------

  const handleEditCard = React.useCallback((card: KanbanCard) => {
    setDialogState({ open: true, mode: "edit", card, columnId: card.columnId });
  }, []);

  const handleAddCard = React.useCallback((columnId: string) => {
    setDialogState({ open: true, mode: "create", columnId });
  }, []);

  const handleAddTask = React.useCallback(() => {
    const firstColumn = sortedColumns[0];
    if (firstColumn) {
      setDialogState({ open: true, mode: "create", columnId: firstColumn.id });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // -------------------------------------------------------------------------
  // Sorted columns
  // -------------------------------------------------------------------------

  const sortedColumns = React.useMemo(
    () => [...store.columns].sort((a, b) => a.position - b.position),
    [store.columns],
  );

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <>
      <KanbanToolbar onAddTask={handleAddTask} />

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="flex flex-row gap-4 overflow-x-auto p-4 pb-6">
          {sortedColumns.map((column) => (
            <KanbanColumn
              key={column.id}
              column={column}
              cards={filteredCardsByColumn.get(column.id) ?? []}
              onEditCard={handleEditCard}
              onAddCard={handleAddCard}
            />
          ))}
          {sortedColumns.length > 0 && (
            <AddColumnButton boardId={sortedColumns[0].boardId} />
          )}
        </div>

        <DragOverlay dropAnimation={null}>
          {activeCard ? <KanbanCardOverlay card={activeCard} /> : null}
        </DragOverlay>
      </DndContext>

      {/* TaskDialog placeholder — wired up once the component exists */}
      {dialogState.open && (
        <div
          aria-hidden="true"
          data-dialog-mode={dialogState.mode}
          data-dialog-column={dialogState.columnId}
          data-dialog-card={dialogState.card?.id}
          style={{ display: "none" }}
          onClick={() => setDialogState(CLOSED_DIALOG)}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// KanbanBoardPage — outer wrapper that provides both contexts
// ---------------------------------------------------------------------------

export function KanbanBoardPage(): React.ReactElement {
  return (
    <KanbanProvider>
      <ToolbarProvider>
        <KanbanBoard />
      </ToolbarProvider>
    </KanbanProvider>
  );
}
