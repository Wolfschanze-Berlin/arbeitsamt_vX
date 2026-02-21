"use client"

import { useMemo } from "react"
import { AlertTriangle, Bot, Check } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"

// ---------------------------------------------------------------------------
// Provider / model catalogue
// ---------------------------------------------------------------------------

interface ModelDef {
  id: string
  name: string
}

interface ProviderDef {
  id: string
  name: string
  tokenKey: string
  models: ModelDef[]
}

const PROVIDERS: ProviderDef[] = [
  {
    id: "anthropic",
    name: "Anthropic",
    tokenKey: "ANTHROPIC_API_KEY",
    models: [
      { id: "claude-opus-4-6", name: "Claude Opus 4.6" },
      { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6" },
      { id: "claude-opus-4-5-20251101", name: "Claude Opus 4.5" },
      { id: "claude-sonnet-4-5-20250929", name: "Claude Sonnet 4.5" },
      { id: "claude-haiku-4-5-20251001", name: "Claude Haiku 4.5" },
    ],
  },
  {
    id: "openai",
    name: "OpenAI",
    tokenKey: "OPENAI_API_KEY",
    models: [
      { id: "gpt-5.2", name: "GPT-5.2" },
      { id: "gpt-5.1", name: "GPT-5.1" },
      { id: "gpt-5", name: "GPT-5" },
      { id: "gpt-5-mini", name: "GPT-5 Mini" },
      { id: "gpt-5-nano", name: "GPT-5 Nano" },
      { id: "o3", name: "o3" },
      { id: "o4-mini", name: "o4-mini" },
    ],
  },
]

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ProviderSelectorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (provider: string, model: string) => void
  apiTokens: Array<{ key: string; value: string }>
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProviderSelector({
  open,
  onOpenChange,
  onSelect,
  apiTokens,
}: ProviderSelectorProps) {
  /** Set of token keys that have a non-empty value configured. */
  const availableKeys = useMemo(
    () => new Set(apiTokens.filter((t) => t.value.length > 0).map((t) => t.key)),
    [apiTokens],
  )

  function handleModelSelect(providerId: string, modelId: string) {
    onSelect(providerId, modelId)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Select a model</DialogTitle>
          <DialogDescription>
            Choose the AI provider and model for this conversation.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-2">
          {PROVIDERS.map((provider) => {
            const hasKey = availableKeys.has(provider.tokenKey)

            return (
              <ProviderCard
                key={provider.id}
                provider={provider}
                hasKey={hasKey}
                onModelSelect={handleModelSelect}
              />
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// ProviderCard (internal)
// ---------------------------------------------------------------------------

interface ProviderCardProps {
  provider: ProviderDef
  hasKey: boolean
  onModelSelect: (providerId: string, modelId: string) => void
}

function ProviderCard({ provider, hasKey, onModelSelect }: ProviderCardProps) {
  return (
    <fieldset
      disabled={!hasKey}
      className={cn(
        "rounded-lg border p-4 transition-opacity",
        !hasKey && "opacity-50",
      )}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium">{provider.name}</span>
        </div>

        {hasKey ? (
          <Badge variant="secondary" className="gap-1 text-xs">
            <Check className="size-3" />
            Key set
          </Badge>
        ) : (
          <Badge variant="outline" className="gap-1 text-xs text-amber-500">
            <AlertTriangle className="size-3" />
            No API key
          </Badge>
        )}
      </div>

      {!hasKey && (
        <p className="mb-3 text-xs text-amber-500">
          Add your {provider.name} API key in Settings to enable these models.
        </p>
      )}

      <RadioGroup
        onValueChange={(modelId: string) =>
          onModelSelect(provider.id, modelId)
        }
      >
        {provider.models.map((model) => (
          <Label
            key={model.id}
            htmlFor={`${provider.id}-${model.id}`}
            className={cn(
              "flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors",
              "hover:bg-accent hover:text-accent-foreground",
              !hasKey && "pointer-events-none",
            )}
          >
            <RadioGroupItem
              id={`${provider.id}-${model.id}`}
              value={model.id}
              disabled={!hasKey}
            />
            {model.name}
          </Label>
        ))}
      </RadioGroup>
    </fieldset>
  )
}

export { PROVIDERS }
export type { ProviderDef, ModelDef, ProviderSelectorProps }
