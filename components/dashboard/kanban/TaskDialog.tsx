"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useKanban } from "@/context/KanbanContext";
import type { KanbanCard } from "@/lib/kanban/types";
import { AttachmentsTab } from "@/components/dashboard/kanban/AttachmentsTab";

// ---------------------------------------------------------------------------
// Form schema
// ---------------------------------------------------------------------------

const TaskFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string(),
  notes: z.string(),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  status: z.enum(["todo", "in_progress", "done"]),
  columnId: z.string().min(1, "Column is required"),
});

type TaskFormValues = z.infer<typeof TaskFormSchema>;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type TaskDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  card?: KanbanCard;
  defaultColumnId?: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
] as const;

const STATUS_OPTIONS = [
  { value: "todo", label: "To Do" },
  { value: "in_progress", label: "In Progress" },
  { value: "done", label: "Done" },
] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TaskDialog({
  open,
  onOpenChange,
  mode,
  card,
  defaultColumnId,
}: TaskDialogProps) {
  const { store, dispatch } = useKanban();

  // Local attachment/cover state — flushed to the store on save
  const [localAttachments, setLocalAttachments] = useState<string[]>(
    card?.attachmentPaths ?? []
  );
  const [localCover, setLocalCover] = useState<string | undefined>(
    card?.coverImagePath
  );

  const defaultValues: TaskFormValues = {
    title: card?.title ?? "",
    description: card?.description ?? "",
    notes: card?.notes ?? "",
    priority: card?.priority ?? "medium",
    status: card?.status ?? "todo",
    columnId: card?.columnId ?? defaultColumnId ?? store.columns[0]?.id ?? "",
  };

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TaskFormValues>({
    resolver: zodResolver(TaskFormSchema),
    defaultValues,
  });

  function onSubmit(values: TaskFormValues) {
    if (mode === "create") {
      dispatch({
        type: "ADD_CARD",
        payload: {
          columnId: values.columnId,
          boardId: store.boards[0]?.id ?? "",
          title: values.title,
          description: values.description,
          notes: values.notes,
          priority: values.priority,
          status: values.status,
          tags: [],
          attachmentPaths: [],
        },
      });
    } else if (card) {
      dispatch({
        type: "UPDATE_CARD",
        payload: {
          cardId: card.id,
          changes: {
            title: values.title,
            description: values.description,
            notes: values.notes,
            priority: values.priority,
            status: values.status,
            attachmentPaths: localAttachments,
            coverImagePath: localCover,
            updatedAt: new Date(),
          },
        },
      });
    }

    reset();
    onOpenChange(false);
  }

  function handleCancel() {
    reset();
    onOpenChange(false);
  }

  // Proxy card with live local state so AttachmentsTab reflects in-progress edits
  const cardProxy: KanbanCard | undefined = card
    ? { ...card, attachmentPaths: localAttachments, coverImagePath: localCover }
    : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent key={card?.id ?? "new"} className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Create Task" : "Edit Task"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <Tabs defaultValue="details" className="w-full">
            <TabsList className="w-full">
              <TabsTrigger value="details" className="flex-1">
                Details
              </TabsTrigger>
              <TabsTrigger value="notes" className="flex-1">
                Notes
              </TabsTrigger>
              <TabsTrigger value="attachments" className="flex-1">
                Attachments
              </TabsTrigger>
            </TabsList>

            {/* ---- Details tab ---- */}
            <TabsContent value="details" className="flex flex-col gap-3 pt-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="title">
                  Title <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="title"
                  placeholder="Task title"
                  aria-invalid={!!errors.title}
                  {...register("title")}
                />
                {errors.title && (
                  <p className="text-destructive text-xs">
                    {errors.title.message}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Add a description..."
                  rows={3}
                  {...register("description")}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label>Priority</Label>
                  <Controller
                    name="priority"
                    control={control}
                    render={({ field }) => (
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                        <SelectContent>
                          {PRIORITY_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label>Status</Label>
                  <Controller
                    name="status"
                    control={control}
                    render={({ field }) => (
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Column</Label>
                <Controller
                  name="columnId"
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <SelectTrigger
                        className="w-full"
                        aria-invalid={!!errors.columnId}
                      >
                        <SelectValue placeholder="Select column" />
                      </SelectTrigger>
                      <SelectContent>
                        {store.columns.map((col) => (
                          <SelectItem key={col.id} value={col.id}>
                            {col.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.columnId && (
                  <p className="text-destructive text-xs">
                    {errors.columnId.message}
                  </p>
                )}
              </div>
            </TabsContent>

            {/* ---- Notes tab ---- */}
            <TabsContent value="notes" className="pt-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Add notes..."
                  rows={5}
                  {...register("notes")}
                />
              </div>
            </TabsContent>

            {/* ---- Attachments tab ---- */}
            <TabsContent value="attachments" className="pt-3">
              <AttachmentsTab
                card={cardProxy}
                mode={mode}
                onAttachmentsChange={setLocalAttachments}
                onCoverChange={setLocalCover}
              />
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {mode === "create" ? "Create Task" : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
