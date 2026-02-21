"use client";

import { useState, useMemo } from "react";
import { formatDistanceToNow } from "date-fns";
import { MessageSquare, Plus, Search, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { useChatContext } from "@/context/ChatContext";
import { useSettings } from "@/context/settings-context";
import type { ChatMeta } from "@/lib/chat/types";
import { ProviderSelector } from "@/components/dashboard/chat/ProviderSelector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ChatHistorySidebar() {
  const { chatList, currentChatId, newChat, selectChat, deleteChat, isLoaded } =
    useChatContext();
  const { settings } = useSettings();

  const [search, setSearch] = useState("");
  const [providerOpen, setProviderOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ChatMeta | null>(null);

  /** Chats filtered by search term, sorted newest-first by updatedAt. */
  const filteredChats = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = term
      ? chatList.filter((c) => c.title.toLowerCase().includes(term))
      : chatList;

    return [...filtered].sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  }, [chatList, search]);

  function handleNewChat(provider: string, model: string) {
    newChat(provider as "anthropic" | "openai", model as never);
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    await deleteChat(deleteTarget.id);
    setDeleteTarget(null);
  }

  // --- Loading state ---
  if (!isLoaded) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading chats...</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* New Chat button */}
      <div className="p-3">
        <Button
          variant="outline"
          className="w-full justify-start gap-2"
          onClick={() => setProviderOpen(true)}
        >
          <Plus className="size-4" />
          New Chat
        </Button>
      </div>

      {/* Search input */}
      {chatList.length > 0 && (
        <div className="px-3 pb-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search chats..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>
      )}

      {/* Chat list */}
      <ScrollArea className="flex-1">
        {filteredChats.length === 0 ? (
          <EmptyState hasChats={chatList.length > 0} />
        ) : (
          <div className="flex flex-col gap-0.5 px-2 pb-2">
            {filteredChats.map((chat) => (
              <ChatListItem
                key={chat.id}
                chat={chat}
                isActive={chat.id === currentChatId}
                onSelect={() => selectChat(chat.id)}
                onDelete={() => setDeleteTarget(chat)}
              />
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Provider selector dialog */}
      <ProviderSelector
        open={providerOpen}
        onOpenChange={setProviderOpen}
        onSelect={handleNewChat}
        apiTokens={settings.apiTokens}
      />

      {/* Delete confirmation dialog */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete chat</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &ldquo;{deleteTarget?.title}&rdquo;.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleConfirmDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ChatListItem (internal)
// ---------------------------------------------------------------------------

interface ChatListItemProps {
  chat: ChatMeta;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

function ChatListItem({ chat, isActive, onSelect, onDelete }: ChatListItemProps) {
  const timeAgo = formatDistanceToNow(new Date(chat.updatedAt), {
    addSuffix: true,
  });

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        "group flex w-full items-start gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors cursor-pointer",
        "hover:bg-accent hover:text-accent-foreground",
        isActive && "bg-accent text-accent-foreground",
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{chat.title}</p>
        <p className="truncate text-xs text-muted-foreground">
          {chat.model} &middot; {timeAgo}
        </p>
      </div>

      <Button
        variant="ghost"
        size="icon-xs"
        className={cn(
          "shrink-0 opacity-0 transition-opacity",
          "group-hover:opacity-100",
          isActive && "opacity-100",
        )}
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        aria-label={`Delete chat: ${chat.title}`}
      >
        <Trash2 className="size-3 text-muted-foreground" />
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// EmptyState (internal)
// ---------------------------------------------------------------------------

function EmptyState({ hasChats }: { hasChats: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center">
      <MessageSquare className="size-8 text-muted-foreground/50" />
      <p className="text-sm text-muted-foreground">
        {hasChats
          ? "No chats match your search."
          : "No conversations yet. Start a new chat to begin."}
      </p>
    </div>
  );
}
