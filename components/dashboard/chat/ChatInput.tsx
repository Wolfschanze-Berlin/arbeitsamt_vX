"use client"

import { useCallback, useRef, useState } from "react"
import { RotateCcw, Send, Square } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface ChatInputProps {
  onSend: (text: string) => void
  onStop: () => void
  onRegenerate?: () => void
  status: string // 'submitted' | 'streaming' | 'ready' | 'error'
  disabled?: boolean
  disabledReason?: string
  showRegenerate?: boolean
}

const MAX_HEIGHT = 120 // ~5 lines

export function ChatInput({
  onSend,
  onStop,
  onRegenerate,
  status,
  disabled = false,
  disabledReason,
  showRegenerate = false,
}: ChatInputProps) {
  const [value, setValue] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const isStreaming = status === "streaming" || status === "submitted"
  const canSend = value.trim().length > 0 && status === "ready" && !disabled

  const resetHeight = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`
  }, [])

  const handleSend = useCallback(() => {
    const trimmed = value.trim()
    if (!trimmed || status !== "ready" || disabled) return
    onSend(trimmed)
    setValue("")
    // Reset textarea height after clearing
    requestAnimationFrame(() => {
      const el = textareaRef.current
      if (el) {
        el.style.height = "auto"
      }
    })
  }, [value, status, disabled, onSend])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend]
  )

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setValue(e.target.value)
      resetHeight()
    },
    [resetHeight]
  )

  return (
    <div className="border-t bg-background px-4 py-3">
      {disabled && disabledReason && (
        <p className="mb-2 text-center text-sm text-amber-500">
          {disabledReason}
        </p>
      )}

      {showRegenerate && status === "ready" && onRegenerate && (
        <div className="mb-2 flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={onRegenerate}
            className="gap-1.5"
          >
            <RotateCcw className="size-3.5" />
            Regenerate
          </Button>
        </div>
      )}

      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={disabled ? "Chat unavailable" : "Send a message..."}
          disabled={disabled || isStreaming}
          rows={1}
          className={cn(
            "flex-1 resize-none overflow-y-auto rounded-lg border bg-transparent px-3 py-2 text-sm",
            "placeholder:text-muted-foreground",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            "disabled:cursor-not-allowed disabled:opacity-50"
          )}
          style={{ maxHeight: MAX_HEIGHT }}
        />

        {isStreaming ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="destructive"
                  size="icon"
                  onClick={onStop}
                  aria-label="Stop generation"
                >
                  <Square className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Stop generation</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="default"
                  size="icon"
                  onClick={handleSend}
                  disabled={!canSend}
                  aria-label="Send message"
                >
                  <Send className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Send message
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    </div>
  )
}
