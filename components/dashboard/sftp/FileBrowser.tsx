"use client";

import * as React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowUp,
  Download,
  File,
  FilePlus,
  Folder,
  FolderPlus,
  Pencil,
  RefreshCw,
  Trash2,
  Upload,
  X,
} from "lucide-react";

import { tauriInvoke, tauriListen } from "@/lib/tauri";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SftpEntry {
  name: string;
  isDir: boolean;
  size: number;
  permissions: number;
  modified: number | null;
}

interface Transfer {
  id: string;
  fileName: string;
  direction: "upload" | "download";
  progress: number;
}

interface FileBrowserProps {
  sessionId: string;
  onClose?: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatPermissions(mode: number): string {
  return "0" + (mode & 0o7777).toString(8).padStart(3, "0");
}

function formatDate(timestamp: number | null): string {
  if (timestamp === null) return "--";
  const date = new Date(timestamp * 1000);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHrs = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHrs / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHrs < 24) return `${diffHrs}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function joinPath(base: string, segment: string): string {
  if (base === "/") return "/" + segment;
  return base + "/" + segment;
}

function splitPathSegments(path: string): { name: string; path: string }[] {
  const parts = path.split("/").filter(Boolean);
  const segments: { name: string; path: string }[] = [
    { name: "/", path: "/" },
  ];
  for (let i = 0; i < parts.length; i++) {
    segments.push({
      name: parts[i],
      path: "/" + parts.slice(0, i + 1).join("/"),
    });
  }
  return segments;
}

function parentPath(path: string): string {
  if (path === "/") return "/";
  const parts = path.split("/").filter(Boolean);
  parts.pop();
  return parts.length === 0 ? "/" : "/" + parts.join("/");
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function FileBrowser({ sessionId, onClose }: FileBrowserProps) {
  const [currentPath, setCurrentPath] = useState("/");
  const [entries, setEntries] = useState<SftpEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transfers, setTransfers] = useState<Transfer[]>([]);

  // Dialog states
  const [renameDialog, setRenameDialog] = useState<{
    open: boolean;
    entry: SftpEntry | null;
  }>({ open: false, entry: null });
  const [newFolderDialog, setNewFolderDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    entry: SftpEntry | null;
  }>({ open: false, entry: null });
  const [inputValue, setInputValue] = useState("");
  const [dialogBusy, setDialogBusy] = useState(false);

  const transferIdCounter = useRef(0);

  // -------------------------------------------------------------------------
  // List directory
  // -------------------------------------------------------------------------

  const listDir = useCallback(
    async (path: string) => {
      setLoading(true);
      setError(null);
      try {
        const result = await tauriInvoke<SftpEntry[]>("sftp_list_dir", {
          sessionId,
          path,
        });
        // Sort: directories first, then alphabetical by name
        const sorted = [...result].sort((a, b) => {
          if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
          return a.name.localeCompare(b.name);
        });
        setEntries(sorted);
        setCurrentPath(path);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [sessionId],
  );

  useEffect(() => {
    listDir("/");
  }, [listDir]);

  // -------------------------------------------------------------------------
  // Navigation
  // -------------------------------------------------------------------------

  const navigateTo = useCallback(
    (path: string) => {
      listDir(path);
    },
    [listDir],
  );

  const handleEntryClick = useCallback(
    (entry: SftpEntry) => {
      if (entry.isDir) {
        navigateTo(joinPath(currentPath, entry.name));
      }
    },
    [currentPath, navigateTo],
  );

  const handleGoUp = useCallback(() => {
    if (currentPath !== "/") {
      navigateTo(parentPath(currentPath));
    }
  }, [currentPath, navigateTo]);

  // -------------------------------------------------------------------------
  // Transfer helpers
  // -------------------------------------------------------------------------

  const addTransfer = useCallback(
    (fileName: string, direction: "upload" | "download"): string => {
      const id = `transfer-${++transferIdCounter.current}`;
      setTransfers((prev) => [...prev, { id, fileName, direction, progress: 0 }]);
      return id;
    },
    [],
  );

  const updateTransferProgress = useCallback(
    (id: string, progress: number) => {
      setTransfers((prev) =>
        prev.map((t) => (t.id === id ? { ...t, progress } : t)),
      );
    },
    [],
  );

  const removeTransfer = useCallback((id: string) => {
    setTransfers((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // -------------------------------------------------------------------------
  // Upload
  // -------------------------------------------------------------------------

  const handleUpload = useCallback(async () => {
    try {
      const { open: openDialog } = await import("@tauri-apps/plugin-dialog");
      const selected = await openDialog({
        multiple: false,
        title: "Select File to Upload",
      });
      if (typeof selected !== "string") return;

      const fileName = selected.split(/[/\\]/).pop() ?? selected;
      const remotePath = joinPath(currentPath, fileName);
      const transferId = addTransfer(fileName, "upload");

      const unlisten = await tauriListen<{ id: string; progress: number }>(
        `sftp-progress-${transferId}`,
        (payload) => {
          updateTransferProgress(transferId, payload.progress);
        },
      );

      try {
        await tauriInvoke<string>("sftp_upload", {
          sessionId,
          localPath: selected,
          remotePath,
          progress: `sftp-progress-${transferId}`,
        });
        // Refresh after upload completes
        await listDir(currentPath);
      } finally {
        removeTransfer(transferId);
        unlisten();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [
    sessionId,
    currentPath,
    addTransfer,
    updateTransferProgress,
    removeTransfer,
    listDir,
  ]);

  // -------------------------------------------------------------------------
  // Download
  // -------------------------------------------------------------------------

  const handleDownload = useCallback(
    async (entry: SftpEntry) => {
      try {
        const { save: saveDialog } = await import("@tauri-apps/plugin-dialog");
        const localPath = await saveDialog({
          title: "Save File As",
          defaultPath: entry.name,
        });
        if (typeof localPath !== "string") return;

        const remotePath = joinPath(currentPath, entry.name);
        const transferId = addTransfer(entry.name, "download");

        const unlisten = await tauriListen<{ id: string; progress: number }>(
          `sftp-progress-${transferId}`,
          (payload) => {
            updateTransferProgress(transferId, payload.progress);
          },
        );

        try {
          await tauriInvoke<string>("sftp_download", {
            sessionId,
            remotePath,
            localPath,
            progress: `sftp-progress-${transferId}`,
          });
        } finally {
          removeTransfer(transferId);
          unlisten();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [
      sessionId,
      currentPath,
      addTransfer,
      updateTransferProgress,
      removeTransfer,
    ],
  );

  // -------------------------------------------------------------------------
  // Rename
  // -------------------------------------------------------------------------

  const handleRenameSubmit = useCallback(async () => {
    if (!renameDialog.entry || !inputValue.trim()) return;
    setDialogBusy(true);
    try {
      const oldPath = joinPath(currentPath, renameDialog.entry.name);
      const newPath = joinPath(currentPath, inputValue.trim());
      await tauriInvoke<void>("sftp_rename", {
        sessionId,
        oldPath,
        newPath,
      });
      setRenameDialog({ open: false, entry: null });
      setInputValue("");
      await listDir(currentPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDialogBusy(false);
    }
  }, [sessionId, currentPath, renameDialog.entry, inputValue, listDir]);

  // -------------------------------------------------------------------------
  // Delete
  // -------------------------------------------------------------------------

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteDialog.entry) return;
    setDialogBusy(true);
    try {
      const path = joinPath(currentPath, deleteDialog.entry.name);
      await tauriInvoke<void>("sftp_delete", {
        sessionId,
        path,
        isDir: deleteDialog.entry.isDir,
      });
      setDeleteDialog({ open: false, entry: null });
      await listDir(currentPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDialogBusy(false);
    }
  }, [sessionId, currentPath, deleteDialog.entry, listDir]);

  // -------------------------------------------------------------------------
  // New Folder
  // -------------------------------------------------------------------------

  const handleNewFolderSubmit = useCallback(async () => {
    if (!inputValue.trim()) return;
    setDialogBusy(true);
    try {
      const path = joinPath(currentPath, inputValue.trim());
      await tauriInvoke<void>("sftp_mkdir", {
        sessionId,
        path,
      });
      setNewFolderDialog(false);
      setInputValue("");
      await listDir(currentPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDialogBusy(false);
    }
  }, [sessionId, currentPath, inputValue, listDir]);

  // -------------------------------------------------------------------------
  // Breadcrumb segments
  // -------------------------------------------------------------------------

  const segments = splitPathSegments(currentPath);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handleGoUp}
          disabled={currentPath === "/" || loading}
          aria-label="Go to parent directory"
        >
          <ArrowUp className="size-4" />
        </Button>

        {/* Breadcrumb navigation */}
        <Breadcrumb className="min-w-0 flex-1">
          <BreadcrumbList>
            {segments.map((seg, i) => {
              const isLast = i === segments.length - 1;
              return (
                <React.Fragment key={seg.path}>
                  {i > 0 && <BreadcrumbSeparator />}
                  <BreadcrumbItem>
                    {isLast ? (
                      <BreadcrumbPage>{seg.name}</BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          navigateTo(seg.path);
                        }}
                      >
                        {seg.name}
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                </React.Fragment>
              );
            })}
          </BreadcrumbList>
        </Breadcrumb>

        {/* Action buttons */}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => listDir(currentPath)}
          disabled={loading}
          aria-label="Refresh"
        >
          <RefreshCw className={cn("size-4", loading && "animate-spin")} />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => {
            setInputValue("");
            setNewFolderDialog(true);
          }}
          disabled={loading}
          aria-label="New folder"
        >
          <FolderPlus className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleUpload}
          disabled={loading}
        >
          <Upload className="size-4" />
          Upload
        </Button>
        {onClose && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            aria-label="Close file browser"
          >
            <X className="size-4" />
          </Button>
        )}
      </div>

      {/* Transfer progress indicators */}
      {transfers.length > 0 && (
        <div className="space-y-1 border-b px-3 py-2">
          {transfers.map((transfer) => (
            <div key={transfer.id} className="flex items-center gap-2 text-xs">
              {transfer.direction === "upload" ? (
                <Upload className="text-muted-foreground size-3 shrink-0" />
              ) : (
                <Download className="text-muted-foreground size-3 shrink-0" />
              )}
              <span className="text-muted-foreground min-w-0 truncate">
                {transfer.fileName}
              </span>
              <Progress value={transfer.progress} className="h-1.5 flex-1" />
              <span className="text-muted-foreground tabular-nums">
                {Math.round(transfer.progress)}%
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="px-3 pt-2">
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      )}

      {/* File table */}
      <ScrollArea className="flex-1">
        {loading ? (
          <div className="space-y-2 p-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="size-5 rounded" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="text-muted-foreground flex flex-col items-center justify-center gap-2 py-12 text-sm">
            <Folder className="size-8 opacity-40" />
            <span>Empty directory</span>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40%]">Name</TableHead>
                <TableHead className="w-[15%]">Size</TableHead>
                <TableHead className="w-[15%]">Permissions</TableHead>
                <TableHead className="w-[20%]">Modified</TableHead>
                <TableHead className="w-[10%]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <ContextMenu key={entry.name}>
                  <ContextMenuTrigger asChild>
                    <TableRow
                      className={cn(
                        entry.isDir && "cursor-pointer",
                        "group",
                      )}
                      onDoubleClick={() => handleEntryClick(entry)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {entry.isDir ? (
                            <Folder className="text-muted-foreground size-4 shrink-0" />
                          ) : (
                            <File className="text-muted-foreground size-4 shrink-0" />
                          )}
                          <button
                            type="button"
                            className={cn(
                              "truncate text-left",
                              entry.isDir &&
                                "hover:text-primary hover:underline",
                            )}
                            onClick={() => handleEntryClick(entry)}
                          >
                            {entry.name}
                          </button>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground tabular-nums">
                        {entry.isDir ? "--" : formatFileSize(entry.size)}
                      </TableCell>
                      <TableCell className="text-muted-foreground font-mono text-xs">
                        {formatPermissions(entry.permissions)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(entry.modified)}
                      </TableCell>
                      <TableCell>
                        {!entry.isDir && (
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            className="opacity-0 group-hover:opacity-100"
                            onClick={() => handleDownload(entry)}
                            aria-label={`Download ${entry.name}`}
                          >
                            <Download className="size-3" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    {entry.isDir && (
                      <ContextMenuItem
                        onClick={() => handleEntryClick(entry)}
                      >
                        <Folder className="size-4" />
                        Open
                      </ContextMenuItem>
                    )}
                    {!entry.isDir && (
                      <ContextMenuItem
                        onClick={() => handleDownload(entry)}
                      >
                        <Download className="size-4" />
                        Download
                      </ContextMenuItem>
                    )}
                    <ContextMenuSeparator />
                    <ContextMenuItem
                      onClick={() => {
                        setInputValue(entry.name);
                        setRenameDialog({ open: true, entry });
                      }}
                    >
                      <Pencil className="size-4" />
                      Rename
                    </ContextMenuItem>
                    <ContextMenuItem
                      variant="destructive"
                      onClick={() => {
                        setDeleteDialog({ open: true, entry });
                      }}
                    >
                      <Trash2 className="size-4" />
                      Delete
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem
                      onClick={() => {
                        setInputValue("");
                        setNewFolderDialog(true);
                      }}
                    >
                      <FolderPlus className="size-4" />
                      New Folder
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              ))}
            </TableBody>
          </Table>
        )}
      </ScrollArea>

      {/* Rename Dialog */}
      <Dialog
        open={renameDialog.open}
        onOpenChange={(open) => {
          if (!open) {
            setRenameDialog({ open: false, entry: null });
            setInputValue("");
          }
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename</DialogTitle>
            <DialogDescription>
              Enter a new name for &quot;{renameDialog.entry?.name}&quot;.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRenameSubmit();
            }}
            disabled={dialogBusy}
            autoFocus
          />
          <DialogFooter>
            <Button
              variant="outline"
              disabled={dialogBusy}
              onClick={() => {
                setRenameDialog({ open: false, entry: null });
                setInputValue("");
              }}
            >
              Cancel
            </Button>
            <Button
              disabled={dialogBusy || !inputValue.trim()}
              onClick={handleRenameSubmit}
            >
              {dialogBusy && <Spinner className="mr-1" />}
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialog.open}
        onOpenChange={(open) => {
          if (!open) setDeleteDialog({ open: false, entry: null });
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;
              {deleteDialog.entry?.name}&quot;?
              {deleteDialog.entry?.isDir &&
                " This will remove the directory and all its contents."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={dialogBusy}
              onClick={() => setDeleteDialog({ open: false, entry: null })}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={dialogBusy}
              onClick={handleDeleteConfirm}
            >
              {dialogBusy && <Spinner className="mr-1" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Folder Dialog */}
      <Dialog
        open={newFolderDialog}
        onOpenChange={(open) => {
          if (!open) {
            setNewFolderDialog(false);
            setInputValue("");
          }
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>New Folder</DialogTitle>
            <DialogDescription>
              Enter a name for the new folder.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleNewFolderSubmit();
            }}
            placeholder="Folder name"
            disabled={dialogBusy}
            autoFocus
          />
          <DialogFooter>
            <Button
              variant="outline"
              disabled={dialogBusy}
              onClick={() => {
                setNewFolderDialog(false);
                setInputValue("");
              }}
            >
              Cancel
            </Button>
            <Button
              disabled={dialogBusy || !inputValue.trim()}
              onClick={handleNewFolderSubmit}
            >
              {dialogBusy && <Spinner className="mr-1" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export { FileBrowser };
export type { FileBrowserProps, SftpEntry };
