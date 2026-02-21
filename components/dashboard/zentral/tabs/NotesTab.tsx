"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Plus,
  Loader2,
  AlertCircle,
  FolderGit2,
  ChevronDown,
  ChevronRight,
  X,
  Info,
  Pencil,
  Trash2,
  Tag,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  getRepoIssues,
  getRepoLabels,
  createIssue,
  updateIssue,
  deleteIssue,
  createLabel,
  GithubError,
  type GithubIssue,
  type GithubLabel,
} from "@/lib/github";
import type { ZentralProjectEntry } from "@/lib/zentral/types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NOTE_LABEL = "zentral-note";

/** Auto-generated colors for new tags (GitHub-friendly hex without #). */
const TAG_COLORS = [
  "0075CA", "E4E669", "D73A4A", "0E8A16", "FBCA04",
  "B60205", "5319E7", "006B75", "1D76DB", "BFD4F2",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function pickColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
}

/** Filter out the system label from display. */
function displayLabels(labels: { name: string; color: string }[]) {
  return labels.filter((l) => l.name !== NOTE_LABEL);
}

// ---------------------------------------------------------------------------
// TagPicker — select existing labels + create new ones
// ---------------------------------------------------------------------------

interface TagPickerProps {
  allLabels: GithubLabel[];
  selected: string[];
  onChange: (tags: string[]) => void;
  onCreateLabel: (name: string) => Promise<void>;
}

function TagPicker({ allLabels, selected, onChange, onCreateLabel }: TagPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return allLabels
      .filter((l) => l.name !== NOTE_LABEL)
      .filter((l) => !q || l.name.toLowerCase().includes(q));
  }, [allLabels, search]);

  const exactMatch = allLabels.some(
    (l) => l.name.toLowerCase() === search.toLowerCase().trim(),
  );

  function toggle(name: string) {
    onChange(
      selected.includes(name)
        ? selected.filter((t) => t !== name)
        : [...selected, name],
    );
  }

  async function handleCreate() {
    const name = search.trim();
    if (!name) return;
    setCreating(true);
    try {
      await onCreateLabel(name);
      if (!selected.includes(name)) {
        onChange([...selected, name]);
      }
      setSearch("");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label className="flex items-center gap-1.5">
        <Tag className="size-3.5" />
        Tags
      </Label>

      {/* Selected tags */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selected.map((name) => {
            const label = allLabels.find((l) => l.name === name);
            return (
              <Badge
                key={name}
                variant="secondary"
                style={label ? { backgroundColor: `#${label.color}`, color: "#000" } : undefined}
                className="gap-1 cursor-pointer text-xs"
                onClick={() => toggle(name)}
              >
                {name}
                <X className="size-3" />
              </Badge>
            );
          })}
        </div>
      )}

      {/* Picker popover */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="w-fit gap-1.5">
            <Plus className="size-3.5" />
            Add tag
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2" align="start">
          <Input
            placeholder="Search or create tag..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-7 text-xs mb-2"
            autoFocus
          />
          <div className="max-h-40 overflow-auto flex flex-col gap-0.5">
            {filtered.map((label) => {
              const isSelected = selected.includes(label.name);
              return (
                <button
                  key={label.name}
                  className="flex items-center gap-2 rounded px-2 py-1 text-xs hover:bg-accent text-left w-full"
                  onClick={() => toggle(label.name)}
                >
                  <span
                    className="size-3 rounded-full shrink-0"
                    style={{ backgroundColor: `#${label.color}` }}
                  />
                  <span className="flex-1 truncate">{label.name}</span>
                  {isSelected && <Check className="size-3 text-primary shrink-0" />}
                </button>
              );
            })}
            {filtered.length === 0 && !search.trim() && (
              <p className="text-xs text-muted-foreground px-2 py-1">No labels in this repo.</p>
            )}
          </div>
          {search.trim() && !exactMatch && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-1 text-xs gap-1.5 justify-start"
              onClick={handleCreate}
              disabled={creating}
            >
              {creating ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Plus className="size-3" />
              )}
              Create &quot;{search.trim()}&quot;
            </Button>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

// ---------------------------------------------------------------------------
// NoteCard
// ---------------------------------------------------------------------------

interface NoteCardProps {
  note: GithubIssue;
  onEdit: (note: GithubIssue) => void;
  onDelete: (note: GithubIssue) => void;
}

function NoteCard({ note, onEdit, onDelete }: NoteCardProps) {
  const [expanded, setExpanded] = useState(false);
  const tags = displayLabels(note.labels);

  return (
    <div className="border rounded-md p-3 flex flex-col gap-2 group">
      <div className="flex items-start gap-2">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-0.5 shrink-0 text-muted-foreground hover:text-foreground"
          aria-label={expanded ? "Collapse" : "Expand"}
        >
          {expanded ? (
            <ChevronDown className="size-4" />
          ) : (
            <ChevronRight className="size-4" />
          )}
        </button>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm leading-tight truncate">{note.title}</p>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <span className="text-xs text-muted-foreground">
              {note.user.login} · {formatDate(note.created_at)}
            </span>
            {tags.map((l) => (
              <Badge
                key={l.name}
                style={{ backgroundColor: `#${l.color}`, color: "#000" }}
                className="text-xs px-1.5 py-0"
              >
                {l.name}
              </Badge>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onEdit(note)}
            className="shrink-0 text-muted-foreground hover:text-foreground"
            title="Edit note"
            aria-label="Edit note"
          >
            <Pencil className="size-3.5" />
          </button>
          <button
            onClick={() => onDelete(note)}
            className="shrink-0 text-muted-foreground hover:text-destructive"
            title="Delete note"
            aria-label="Delete note"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>
      {expanded && note.body && (
        <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono bg-muted rounded p-2 mt-1 overflow-auto max-h-48">
          {note.body}
        </pre>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface NotesTabProps {
  project: ZentralProjectEntry;
}

export function NotesTab({ project }: NotesTabProps) {
  const [notes, setNotes] = useState<GithubIssue[]>([]);
  const [allLabels, setAllLabels] = useState<GithubLabel[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [labelMissing, setLabelMissing] = useState(false);
  const [creatingLabel, setCreatingLabel] = useState(false);
  const [search, setSearch] = useState("");
  const [filterTag, setFilterTag] = useState<string | null>(null);

  // Sheet state (create + edit)
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<GithubIssue | null>(null);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [noteTags, setNoteTags] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<GithubIssue | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { repoFullName } = project;
  const [owner, repo] = repoFullName ? repoFullName.split("/") : ["", ""];

  // ---- Fetch notes + labels ----

  const fetchData = useCallback(async () => {
    if (!owner || !repo) return;
    setLoading(true);
    setError(null);
    try {
      const [issues, labels] = await Promise.all([
        getRepoIssues(owner, repo, [NOTE_LABEL]),
        getRepoLabels(owner, repo).catch(() => [] as GithubLabel[]),
      ]);
      setNotes(issues);
      setAllLabels(labels);
      setLabelMissing(false);
    } catch (err) {
      if (
        err instanceof GithubError &&
        (err.kind === "NotFound" || err.status === 422)
      ) {
        setLabelMissing(true);
      } else {
        setError(err instanceof Error ? err.message : "Failed to load notes");
      }
    } finally {
      setLoading(false);
    }
  }, [owner, repo]);

  useEffect(() => {
    if (repoFullName) fetchData();
  }, [repoFullName, fetchData]);

  // ---- Filtering ----

  const filtered = useMemo(() => {
    let result = notes;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((n) => n.title.toLowerCase().includes(q));
    }
    if (filterTag) {
      result = result.filter((n) =>
        n.labels.some((l) => l.name === filterTag),
      );
    }
    return result;
  }, [notes, search, filterTag]);

  /** Unique tags across all notes (excluding system label). */
  const usedTags = useMemo(() => {
    const set = new Set<string>();
    for (const note of notes) {
      for (const l of note.labels) {
        if (l.name !== NOTE_LABEL) set.add(l.name);
      }
    }
    return Array.from(set).sort();
  }, [notes]);

  // ---- Label bootstrap ----

  async function handleCreateNoteLabel() {
    setCreatingLabel(true);
    try {
      await createLabel(owner, repo, NOTE_LABEL, "C5DEF5", "Zentral project note");
      setLabelMissing(false);
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create label");
    } finally {
      setCreatingLabel(false);
    }
  }

  // ---- Create new tag (inline from TagPicker) ----

  async function handleCreateTag(name: string) {
    const color = pickColor(name);
    await createLabel(owner, repo, name, color, "");
    setAllLabels((prev) => [...prev, { name, color, description: null }]);
  }

  // ---- Open sheet for create / edit ----

  function openCreateSheet() {
    setEditingNote(null);
    setNoteTitle("");
    setNoteBody("");
    setNoteTags([]);
    setSubmitError(null);
    setSheetOpen(true);
  }

  function openEditSheet(note: GithubIssue) {
    setEditingNote(note);
    setNoteTitle(note.title);
    setNoteBody(note.body ?? "");
    setNoteTags(displayLabels(note.labels).map((l) => l.name));
    setSubmitError(null);
    setSheetOpen(true);
  }

  // ---- Save (create or update) ----

  async function handleSave() {
    if (!noteTitle.trim()) return;
    setSubmitting(true);
    setSubmitError(null);

    // Always include the system label
    const labels = [NOTE_LABEL, ...noteTags.filter((t) => t !== NOTE_LABEL)];

    try {
      if (editingNote) {
        // Update existing
        const updated = await updateIssue(owner, repo, editingNote.number, {
          title: noteTitle.trim(),
          body: noteBody,
          labels,
        });
        setNotes((prev) =>
          prev.map((n) => (n.number === updated.number ? updated : n)),
        );
      } else {
        // Create new
        const created = await createIssue(owner, repo, {
          title: noteTitle.trim(),
          body: noteBody,
          labels,
        });
        setNotes((prev) => [created, ...prev]);
      }
      setSheetOpen(false);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to save note");
    } finally {
      setSubmitting(false);
    }
  }

  // ---- Delete ----

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteIssue(owner, repo, deleteTarget.number);
      setNotes((prev) => prev.filter((n) => n.number !== deleteTarget.number));
      setDeleteTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete note");
    } finally {
      setDeleting(false);
    }
  }

  // ---- Render guards ----

  if (!repoFullName) {
    return (
      <Alert>
        <FolderGit2 className="size-4" />
        <AlertDescription>
          No GitHub repo linked — notes require a GitHub repo.
        </AlertDescription>
      </Alert>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="text-muted-foreground size-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="size-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Alert>
        <Info className="size-4" />
        <AlertDescription>
          Notes are stored as GitHub Issues with the &apos;zentral-note&apos; label.
        </AlertDescription>
      </Alert>

      {labelMissing && (
        <Alert>
          <AlertCircle className="size-4" />
          <AlertDescription className="flex items-center justify-between gap-2 flex-wrap">
            <span>The &apos;zentral-note&apos; label does not exist yet in this repo.</span>
            <Button
              size="sm"
              variant="outline"
              onClick={handleCreateNoteLabel}
              disabled={creatingLabel}
            >
              {creatingLabel && <Loader2 className="mr-1 size-3 animate-spin" />}
              Create label
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Search + tag filter + new button */}
      <div className="flex items-center gap-2">
        <Input
          placeholder="Search notes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 text-sm"
        />
        <Button size="sm" onClick={openCreateSheet} disabled={labelMissing}>
          <Plus className="size-4 mr-1" />
          New note
        </Button>
      </div>

      {/* Tag filter chips */}
      {usedTags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          <Badge
            variant={filterTag === null ? "default" : "outline"}
            className="cursor-pointer text-xs"
            onClick={() => setFilterTag(null)}
          >
            All
          </Badge>
          {usedTags.map((tag) => {
            const label = allLabels.find((l) => l.name === tag);
            const isActive = filterTag === tag;
            return (
              <Badge
                key={tag}
                variant={isActive ? "default" : "outline"}
                style={
                  isActive && label
                    ? { backgroundColor: `#${label.color}`, color: "#000" }
                    : undefined
                }
                className="cursor-pointer text-xs"
                onClick={() => setFilterTag(isActive ? null : tag)}
              >
                {tag}
              </Badge>
            );
          })}
        </div>
      )}

      {/* Notes list */}
      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          {notes.length === 0 ? "No notes yet." : "No notes match your search."}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((note) => (
            <NoteCard
              key={note.number}
              note={note}
              onEdit={openEditSheet}
              onDelete={setDeleteTarget}
            />
          ))}
        </div>
      )}

      {/* Create / Edit sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>{editingNote ? "Edit note" : "New note"}</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-4 px-4 flex-1">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="note-title">Title</Label>
              <Input
                id="note-title"
                placeholder="Note title"
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5 flex-1">
              <Label htmlFor="note-body">Body (Markdown)</Label>
              <Textarea
                id="note-body"
                placeholder="Write your note..."
                value={noteBody}
                onChange={(e) => setNoteBody(e.target.value)}
                className="font-mono text-sm resize-none min-h-48"
              />
            </div>
            <TagPicker
              allLabels={allLabels}
              selected={noteTags}
              onChange={setNoteTags}
              onCreateLabel={handleCreateTag}
            />
            {submitError && (
              <p className="text-sm text-destructive">{submitError}</p>
            )}
          </div>
          <SheetFooter>
            <Button
              onClick={handleSave}
              disabled={submitting || !noteTitle.trim()}
              className="w-full"
            >
              {submitting && <Loader2 className="mr-2 size-4 animate-spin" />}
              {editingNote ? "Save changes" : "Create"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete note</AlertDialogTitle>
            <AlertDialogDescription>
              This will close the GitHub issue &quot;{deleteTarget?.title}&quot;. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="mr-2 size-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
