import type { KanbanStore, KanbanAction, KanbanCard } from "./types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Reindex cards in-place so each card.position equals its array index. */
function reindex(cards: KanbanCard[]): KanbanCard[] {
  return cards.map((card, i) => ({ ...card, position: i }));
}

const now = () => new Date();

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

export function kanbanReducer(
  state: KanbanStore,
  action: KanbanAction,
): KanbanStore {
  switch (action.type) {
    case "MOVE_CARD_SAME_COLUMN": {
      const { columnId, cardId, toPosition } = action.payload;

      const columnCards = state.cards
        .filter((c) => c.columnId === columnId)
        .sort((a, b) => a.position - b.position);

      const fromIndex = columnCards.findIndex((c) => c.id === cardId);
      if (fromIndex === -1) return state;

      const [moved] = columnCards.splice(fromIndex, 1);
      const clampedTo = Math.min(toPosition, columnCards.length);
      columnCards.splice(clampedTo, 0, moved);

      const reindexed = reindex(columnCards);
      const reindexedIds = new Set(reindexed.map((c) => c.id));

      return {
        ...state,
        cards: [
          ...state.cards.filter((c) => !reindexedIds.has(c.id)),
          ...reindexed,
        ],
      };
    }

    case "MOVE_CARD_CROSS_COLUMN": {
      const { cardId, fromColumnId, toColumnId, toPosition } = action.payload;

      const movedCard = state.cards.find((c) => c.id === cardId);
      if (!movedCard) return state;

      const sourceCards = state.cards
        .filter((c) => c.columnId === fromColumnId && c.id !== cardId)
        .sort((a, b) => a.position - b.position);

      const targetCards = state.cards
        .filter((c) => c.columnId === toColumnId)
        .sort((a, b) => a.position - b.position);

      const updatedMoved: KanbanCard = {
        ...movedCard,
        columnId: toColumnId,
        updatedAt: now(),
      };

      const clampedTo = Math.min(toPosition, targetCards.length);
      targetCards.splice(clampedTo, 0, updatedMoved);

      const reindexedSource = reindex(sourceCards);
      const reindexedTarget = reindex(targetCards);

      const touchedIds = new Set([
        ...reindexedSource.map((c) => c.id),
        ...reindexedTarget.map((c) => c.id),
        cardId,
      ]);

      return {
        ...state,
        cards: [
          ...state.cards.filter((c) => !touchedIds.has(c.id)),
          ...reindexedSource,
          ...reindexedTarget,
        ],
      };
    }

    case "ADD_CARD": {
      const columnCards = state.cards.filter(
        (c) => c.columnId === action.payload.columnId,
      );
      const position = columnCards.length;
      const newCard: KanbanCard = {
        ...action.payload,
        id: crypto.randomUUID(),
        position,
        createdAt: now(),
        updatedAt: now(),
      };
      return { ...state, cards: [...state.cards, newCard] };
    }

    case "UPDATE_CARD": {
      const { cardId, changes } = action.payload;
      return {
        ...state,
        cards: state.cards.map((card) =>
          card.id === cardId
            ? { ...card, ...changes, id: card.id, boardId: card.boardId, createdAt: card.createdAt, updatedAt: now() }
            : card,
        ),
      };
    }

    case "DELETE_CARD": {
      return {
        ...state,
        cards: state.cards.filter((c) => c.id !== action.payload.cardId),
      };
    }

    case "ADD_COLUMN": {
      const boardColumns = state.columns.filter(
        (col) => col.boardId === action.payload.boardId,
      );
      const newColumn = {
        ...action.payload,
        id: crypto.randomUUID(),
        position: boardColumns.length,
        createdAt: now(),
      };
      return { ...state, columns: [...state.columns, newColumn] };
    }

    case "RENAME_COLUMN": {
      const { columnId, title } = action.payload;
      return {
        ...state,
        columns: state.columns.map((col) =>
          col.id === columnId ? { ...col, title } : col,
        ),
      };
    }

    case "DELETE_COLUMN": {
      const { columnId } = action.payload;
      return {
        ...state,
        columns: state.columns.filter((col) => col.id !== columnId),
        cards: state.cards.filter((c) => c.columnId !== columnId),
      };
    }

    case "RESTORE_SNAPSHOT": {
      return action.payload;
    }

    case "LOAD_BOARD": {
      // boardId is informational — no state change needed here;
      // the context seeds initial state via kanbanLoadSafe before mount.
      return state;
    }

    default: {
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}
