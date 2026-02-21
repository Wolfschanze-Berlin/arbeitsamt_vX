"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Plus,
  Loader2,
  AlertCircle,
  FolderGit2,
  ChevronDown,
  ChevronRight,
  X,
  Info,
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
  getRepoIssues,
  createIssue,
  closeIssue,
  createLabel,
  GithubError,
  type GithubIssue,
} from "@/lib/github";
import type { ZentralProjectEntry } from "@/lib/zentral/types";

const NOTE_LABEL = "zentral-note";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

interface NoteCardProps {
  note: GithubIssue;
  onClose: (n: number) => Promise<void>;
}

function NoteCard({ note, onClose }: NoteCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [closing, setClosing] = useState(false);

  async function handleClose() {
    setClosing(true);
    await onClose(note.number);
    setClosing(false);
  }

  return (
    <div className="border rounded-md p-3 flex flex-col gap-2">
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
            {note.labels.map((l) => (
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
        <button
          onClick={handleClose}
          disabled={closing}
          className="shrink-0 text-muted-foreground hover:text-destructive disabled:opacity-50"
          title="Archive note"
          aria-label="Close note"
        >
          {closing ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <X className="size-4" />
          )}
        </button>
      </div>
      {expanded && note.body && (
        <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono bg-muted rounded p-2 mt-1 overflow-auto max-h-48">
          {note.body}
        </pre>
      )}
    </div>
  );
}

interface NotesTabProps {
  project: ZentralProjectEntry;
}

export function NotesTab({ project }: NotesTabProps) {
  const [notes, setNotes] = useState<GithubIssue[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [labelMissing, setLabelMissing] = useState(false);
  const [creatingLabel, setCreatingLabel] = useState(false);
  const [search, setSearch] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { repoFullName } = project;
  const [owner, repo] = repoFullName ? repoFullName.split("/") : ["", ""];

  const fetchNotes = useCallback(async () => {
    if (!owner || !repo) return;
    setLoading(true);
    setError(null);
    try {
      const issues = await getRepoIssues(owner, repo, [NOTE_LABEL]);
      setNotes(issues);
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
    if (repoFullName) fetchNotes();
  }, [repoFullName, fetchNotes]);

  const filtered = notes.filter((n) =>
    n.title.toLowerCase().includes(search.toLowerCase()),
  );

  async function handleCreateLabel() {
    setCreatingLabel(true);
    try {
      await createLabel(owner, repo, NOTE_LABEL, "C5DEF5", "Zentral project note");
      setLabelMissing(false);
      await fetchNotes();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create label");
    } finally {
      setCreatingLabel(false);
    }
  }

  async function handleCreateNote() {
    if (!noteTitle.trim()) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const created = await createIssue(owner, repo, {
        title: noteTitle.trim(),
        body: noteBody,
        labels: [NOTE_LABEL],
      });
      setNotes((prev) => [created, ...prev]);
      setNoteTitle("");
      setNoteBody("");
      setSheetOpen(false);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to create note");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCloseNote(issueNumber: number) {
    await closeIssue(owner, repo, issueNumber);
    setNotes((prev) => prev.filter((n) => n.number !== issueNumber));
  }

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
              onClick={handleCreateLabel}
              disabled={creatingLabel}
            >
              {creatingLabel && <Loader2 className="mr-1 size-3 animate-spin" />}
              Create label
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex items-center gap-2">
        <Input
          placeholder="Search notes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 text-sm"
        />
        <Button size="sm" onClick={() => setSheetOpen(true)} disabled={labelMissing}>
          <Plus className="size-4 mr-1" />
          New note
        </Button>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          {notes.length === 0 ? "No notes yet." : "No notes match your search."}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((note) => (
            <NoteCard key={note.number} note={note} onClose={handleCloseNote} />
          ))}
        </div>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>New note</SheetTitle>
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
            {submitError && (
              <p className="text-sm text-destructive">{submitError}</p>
            )}
          </div>
          <SheetFooter>
            <Button
              onClick={handleCreateNote}
              disabled={submitting || !noteTitle.trim()}
              className="w-full"
            >
              {submitting && <Loader2 className="mr-2 size-4 animate-spin" />}
              Create
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
