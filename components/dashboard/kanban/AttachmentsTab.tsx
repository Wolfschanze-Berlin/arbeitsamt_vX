"use client";

import { useState, useCallback } from "react";
import { Paperclip, Image, Trash2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import type { KanbanCard } from "@/lib/kanban/types";
import {
  pickAndCopyAttachments,
  pickAndCopyCoverImage,
  removeAttachment,
} from "@/lib/kanban/attachments";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function filenameFromPath(p: string): string {
  return p.replace(/\\/g, "/").split("/").pop() ?? p;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export type AttachmentsTabProps = {
  card: KanbanCard | undefined;
  mode: "create" | "edit";
  onAttachmentsChange: (paths: string[]) => void;
  onCoverChange: (path: string | undefined) => void;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AttachmentsTab({
  card,
  mode,
  onAttachmentsChange,
  onCoverChange,
}: AttachmentsTabProps) {
  const [addingAttachments, setAddingAttachments] = useState(false);
  const [settingCover, setSettingCover] = useState(false);
  const tauriAvailable = isTauri();

  const attachmentPaths: string[] = card?.attachmentPaths ?? [];
  const coverImagePath: string | undefined = card?.coverImagePath;

  const handleAddAttachments = useCallback(async () => {
    if (!card) return;
    setAddingAttachments(true);
    try {
      const newPaths = await pickAndCopyAttachments(card.id);
      if (newPaths.length > 0) {
        onAttachmentsChange([...attachmentPaths, ...newPaths]);
      }
    } finally {
      setAddingAttachments(false);
    }
  }, [card, attachmentPaths, onAttachmentsChange]);

  const handleRemoveAttachment = useCallback(
    async (path: string) => {
      await removeAttachment(path);
      onAttachmentsChange(attachmentPaths.filter((p) => p !== path));
    },
    [attachmentPaths, onAttachmentsChange]
  );

  const handleSetCover = useCallback(async () => {
    if (!card) return;
    setSettingCover(true);
    try {
      const path = await pickAndCopyCoverImage(card.id);
      if (path) onCoverChange(path);
    } finally {
      setSettingCover(false);
    }
  }, [card, onCoverChange]);

  const handleRemoveCover = useCallback(async () => {
    if (coverImagePath) await removeAttachment(coverImagePath);
    onCoverChange(undefined);
  }, [coverImagePath, onCoverChange]);

  function DisabledWrapper({ children }: { children: React.ReactNode }) {
    if (!tauriAvailable) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>{children}</TooltipTrigger>
            <TooltipContent>Desktop only</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }
    return <>{children}</>;
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Attachment list */}
      {attachmentPaths.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {attachmentPaths.map((path) => (
            <li
              key={path}
              className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
            >
              <span className="flex items-center gap-2 truncate text-muted-foreground">
                <Paperclip className="size-3.5 shrink-0" />
                <span className="truncate">{filenameFromPath(path)}</span>
              </span>
              <DisabledWrapper>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-6 shrink-0 text-destructive hover:text-destructive"
                  disabled={!tauriAvailable}
                  onClick={() => handleRemoveAttachment(path)}
                  aria-label={`Remove ${filenameFromPath(path)}`}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </DisabledWrapper>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-sm">No attachments yet.</p>
      )}

      {/* Add attachment button */}
      <DisabledWrapper>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!tauriAvailable || addingAttachments || !card}
          onClick={handleAddAttachments}
          className="w-fit"
        >
          {addingAttachments ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Paperclip className="size-3.5" />
          )}
          Add Attachment
        </Button>
      </DisabledWrapper>

      {/* Cover image section — edit mode only */}
      {mode === "edit" && (
        <div className="flex flex-col gap-2 border-t pt-3">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Cover Image
          </Label>

          {coverImagePath ? (
            <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
              <span className="flex items-center gap-2 truncate text-muted-foreground">
                <Image className="size-3.5 shrink-0" />
                <span className="truncate">{filenameFromPath(coverImagePath)}</span>
              </span>
              <DisabledWrapper>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-6 shrink-0 text-destructive hover:text-destructive"
                  disabled={!tauriAvailable}
                  onClick={handleRemoveCover}
                  aria-label="Remove cover image"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </DisabledWrapper>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No cover image set.</p>
          )}

          <DisabledWrapper>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!tauriAvailable || settingCover || !card}
              onClick={handleSetCover}
              className="w-fit"
            >
              {settingCover ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Image className="size-3.5" />
              )}
              Set Cover Image
            </Button>
          </DisabledWrapper>
        </div>
      )}
    </div>
  );
}
