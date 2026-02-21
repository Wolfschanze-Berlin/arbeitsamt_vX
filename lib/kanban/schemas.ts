import { z } from "zod";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const PriorityEnum = z.enum(["low", "medium", "high", "urgent"]);

export const StatusEnum = z.enum(["todo", "in_progress", "done"]);

// ---------------------------------------------------------------------------
// KanbanCard
// ---------------------------------------------------------------------------

/** Schema for a single card on the board. IDs are generated via crypto.randomUUID(). */
export const KanbanCardSchema = z.object({
  id: z.string().uuid(),
  columnId: z.string().uuid(),
  boardId: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().default(""),
  notes: z.string().default(""),
  priority: PriorityEnum,
  status: StatusEnum,
  tags: z.array(z.string()).default([]),
  dueDate: z.coerce.date().optional(),
  attachmentPaths: z.array(z.string()).default([]),
  coverImagePath: z.string().optional(),
  /** Array-index position within the column (integer, not float). */
  position: z.number().int().nonnegative(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

// ---------------------------------------------------------------------------
// KanbanColumn
// ---------------------------------------------------------------------------

/** Schema for a column in a board. IDs are generated via crypto.randomUUID(). */
export const KanbanColumnSchema = z.object({
  id: z.string().uuid(),
  boardId: z.string().uuid(),
  title: z.string().min(1),
  /** Array-index position within the board (integer, not float). */
  position: z.number().int().nonnegative(),
  cardLimit: z.number().int().positive().optional(),
  color: z.string().optional(),
  createdAt: z.coerce.date(),
});

// ---------------------------------------------------------------------------
// KanbanBoard
// ---------------------------------------------------------------------------

/** Schema for a board. IDs are generated via crypto.randomUUID(). */
export const KanbanBoardSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

// ---------------------------------------------------------------------------
// KanbanStore — top-level persisted shape
// ---------------------------------------------------------------------------

export const KanbanStoreSchema = z.object({
  version: z.literal(1),
  boards: z.array(KanbanBoardSchema),
  columns: z.array(KanbanColumnSchema),
  cards: z.array(KanbanCardSchema),
});
