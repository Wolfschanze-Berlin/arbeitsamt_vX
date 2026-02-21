"use client"

import { useState } from "react"
import type { UIMessage } from "ai"
import { AlertTriangle, Bot, ChevronDown, RotateCcw, Sparkles } from "lucide-react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { PROVIDERS, ProviderSelector } from "@/components/dashboard/chat/ProviderSelector"

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ChatWindowProps {
  messages: UIMessage[]
  status: string
  error?: Error
  provider: string
  model: string
  onSend: (text: string) => void
  onStop: () => void
  onRegenerate: () => void
  onModelChange?: (provider: string, model: string) => void
  hasApiKey: boolean
  apiTokens?: Array<{ key: string; value: string }>
  /** Slot for the message list component. */
  children?: React.ReactNode
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Resolve a human-readable model name from the catalogue. */
function resolveModelName(provider: string, model: string): string {
  const p = PROVIDERS.find((pr) => pr.id === provider)
  if (!p) return model
  const m = p.models.find((md) => md.id === model)
  return m ? m.name : model
}

/** Resolve a human-readable provider name from the catalogue. */
function resolveProviderName(provider: string): string {
  const p = PROVIDERS.find((pr) => pr.id === provider)
  return p ? p.name : provider
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
        <Bot className="size-6 text-muted-foreground" />
      </div>
      <div>
        <h3 className="text-sm font-medium">Start a conversation</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Type a message below to begin chatting with the AI assistant.
        </p>
      </div>
    </div>
  )
}

function ErrorBanner({ error }: { error: Error }) {
  return (
    <div className="mx-4 mt-2 flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <div>
        <p className="font-medium">Something went wrong</p>
        <p className="mt-0.5 text-xs opacity-80">
          {error.message || "An unknown error occurred."}
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ChatWindow
// ---------------------------------------------------------------------------

export function ChatWindow({
  messages,
  status,
  error,
  provider,
  model,
  onRegenerate,
  onModelChange,
  hasApiKey,
  apiTokens = [],
  children,
}: ChatWindowProps) {
  const [selectorOpen, setSelectorOpen] = useState(false)
  const modelName = resolveModelName(provider, model)
  const providerName = resolveProviderName(provider)
  const isStreaming = status === "streaming" || status === "submitted"
  const hasMessages = messages.length > 0
  const showRegenerate =
    hasMessages && !isStreaming && status !== "error"

  return (
    <div className="flex h-full flex-col">
      {/* ---- Header ---- */}
      <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-background/95 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <button
          type="button"
          onClick={() => onModelChange && setSelectorOpen(true)}
          className={cn(
            "flex items-center gap-2 rounded-md px-1.5 py-1 transition-colors",
            onModelChange && "hover:bg-accent cursor-pointer",
          )}
        >
          <Sparkles className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium">{providerName}</span>
          <Badge variant="secondary" className="text-xs">
            {modelName}
          </Badge>
          {onModelChange && (
            <ChevronDown className="size-3 text-muted-foreground" />
          )}
        </button>

        <div className="flex items-center gap-1">
          {!hasApiKey && (
            <Badge
              variant="outline"
              className="gap-1 text-xs text-amber-500"
            >
              <AlertTriangle className="size-3" />
              No API key
            </Badge>
          )}

          {showRegenerate && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onRegenerate}
              aria-label="Regenerate last response"
            >
              <RotateCcw className="size-3.5" />
            </Button>
          )}
        </div>
      </header>

      {/* ---- Error banner ---- */}
      {status === "error" && error && <ErrorBanner error={error} />}

      {/* ---- Message area ---- */}
      <ScrollArea className="flex-1">
        {hasMessages ? (
          <div className={cn("flex flex-col gap-4 px-4 py-4")}>
            {children}
          </div>
        ) : (
          <EmptyState />
        )}
      </ScrollArea>

      {/* ---- Model selector dialog ---- */}
      {onModelChange && (
        <ProviderSelector
          open={selectorOpen}
          onOpenChange={setSelectorOpen}
          onSelect={onModelChange}
          apiTokens={apiTokens}
        />
      )}
    </div>
  )
}

export type { ChatWindowProps }
