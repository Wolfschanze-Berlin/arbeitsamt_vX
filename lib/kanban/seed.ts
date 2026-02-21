import type { KanbanBoard, KanbanColumn, KanbanStore } from "./types";

// ---------------------------------------------------------------------------
// IDs — generated once at module load time (static, stable within a session)
// ---------------------------------------------------------------------------

const BOARD_ID = crypto.randomUUID();
const COL_TODO_ID = crypto.randomUUID();
const COL_IN_PROGRESS_ID = crypto.randomUUID();
const COL_DONE_ID = crypto.randomUUID();

const SEED_DATE = new Date();

// ---------------------------------------------------------------------------
// Default board
// ---------------------------------------------------------------------------

export const DEFAULT_BOARD: KanbanBoard = {
  id: BOARD_ID,
  title: "My Board",
  description: "",
  createdAt: SEED_DATE,
  updatedAt: SEED_DATE,
};

// ---------------------------------------------------------------------------
// Default columns (sequential positions 0, 1, 2)
// ---------------------------------------------------------------------------

export const DEFAULT_COLUMNS: KanbanColumn[] = [
  {
    id: COL_TODO_ID,
    boardId: BOARD_ID,
    title: "To Do",
    position: 0,
    createdAt: SEED_DATE,
  },
  {
    id: COL_IN_PROGRESS_ID,
    boardId: BOARD_ID,
    title: "In Progress",
    position: 1,
    createdAt: SEED_DATE,
  },
  {
    id: COL_DONE_ID,
    boardId: BOARD_ID,
    title: "Done",
    position: 2,
    createdAt: SEED_DATE,
  },
];

// ---------------------------------------------------------------------------
// Default store
// ---------------------------------------------------------------------------

export const DEFAULT_STORE: KanbanStore = {
  version: 1,
  boards: [DEFAULT_BOARD],
  columns: DEFAULT_COLUMNS,
  cards: [],
};
