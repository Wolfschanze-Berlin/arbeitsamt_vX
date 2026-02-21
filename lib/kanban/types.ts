import type { z } from "zod";
import type {
  KanbanBoardSchema,
  KanbanCardSchema,
  KanbanColumnSchema,
  KanbanStoreSchema,
  PriorityEnum,
  StatusEnum,
} from "./schemas";

// ---------------------------------------------------------------------------
// Derived entity types (Zod is the single source of truth)
// ---------------------------------------------------------------------------

export type Priority = z.infer<typeof PriorityEnum>;
export type Status = z.infer<typeof StatusEnum>;

export type KanbanCard = z.infer<typeof KanbanCardSchema>;
export type KanbanColumn = z.infer<typeof KanbanColumnSchema>;
export type KanbanBoard = z.infer<typeof KanbanBoardSchema>;
export type KanbanStore = z.infer<typeof KanbanStoreSchema>;

// ---------------------------------------------------------------------------
// Reducer action types
// ---------------------------------------------------------------------------

export type MoveCardSameColumnAction = {
  type: "MOVE_CARD_SAME_COLUMN";
  payload: {
    columnId: string;
    cardId: string;
    toPosition: number;
  };
};

export type MoveCardCrossColumnAction = {
  type: "MOVE_CARD_CROSS_COLUMN";
  payload: {
    cardId: string;
    fromColumnId: string;
    toColumnId: string;
    toPosition: number;
  };
};

export type AddCardAction = {
  type: "ADD_CARD";
  payload: Omit<KanbanCard, "id" | "position" | "createdAt" | "updatedAt">;
};

export type UpdateCardAction = {
  type: "UPDATE_CARD";
  payload: {
    cardId: string;
    changes: Partial<
      Omit<KanbanCard, "id" | "boardId" | "columnId" | "createdAt">
    >;
  };
};

export type DeleteCardAction = {
  type: "DELETE_CARD";
  payload: { cardId: string };
};

export type AddColumnAction = {
  type: "ADD_COLUMN";
  payload: Omit<KanbanColumn, "id" | "position" | "createdAt">;
};

export type RenameColumnAction = {
  type: "RENAME_COLUMN";
  payload: { columnId: string; title: string };
};

export type DeleteColumnAction = {
  type: "DELETE_COLUMN";
  payload: { columnId: string };
};

export type RestoreSnapshotAction = {
  type: "RESTORE_SNAPSHOT";
  payload: KanbanStore;
};

export type LoadBoardAction = {
  type: "LOAD_BOARD";
  payload: { boardId: string };
};

// ---------------------------------------------------------------------------
// Discriminated union of all actions
// ---------------------------------------------------------------------------

export type KanbanAction =
  | MoveCardSameColumnAction
  | MoveCardCrossColumnAction
  | AddCardAction
  | UpdateCardAction
  | DeleteCardAction
  | AddColumnAction
  | RenameColumnAction
  | DeleteColumnAction
  | RestoreSnapshotAction
  | LoadBoardAction;
