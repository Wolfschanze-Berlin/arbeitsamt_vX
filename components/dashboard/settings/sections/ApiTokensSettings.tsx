"use client";

import { useState, useEffect } from "react";
import { Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import { useSettings } from "@/context/settings-context";
import { PREDEFINED_TOKENS, type ApiToken } from "@/lib/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function TokenRow({
  token,
  onUpdate,
  onRemove,
}: {
  token: ApiToken;
  onUpdate: (token: ApiToken) => void;
  onRemove: (id: string) => void;
}) {
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="rounded-lg border p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-mono font-medium">{token.key}</p>
          {token.description && (
            <p className="text-xs text-muted-foreground">{token.description}</p>
          )}
        </div>
        {token.isCustom && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onRemove(token.id)}
            aria-label={`Remove ${token.key}`}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Input
          type={revealed ? "text" : "password"}
          value={token.value}
          onChange={(e) => onUpdate({ ...token, value: e.target.value })}
          placeholder="Paste token here..."
          className="font-mono text-sm"
        />
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setRevealed((v) => !v)}
          aria-label={revealed ? "Hide token" : "Reveal token"}
        >
          {revealed ? (
            <EyeOff className="h-4 w-4" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}

export function ApiTokensSettings() {
  const { settings, addToken, updateToken, removeToken } = useSettings();
  const [adding, setAdding] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newDesc, setNewDesc] = useState("");

  // Ensure predefined tokens always appear (create placeholders if missing)
  useEffect(() => {
    for (const preset of PREDEFINED_TOKENS) {
      if (!settings.apiTokens.some((t) => t.key === preset.key)) {
        addToken({
          id: crypto.randomUUID(),
          key: preset.key,
          value: "",
          description: preset.description,
          isCustom: false,
        });
      }
    }
  }, [settings.apiTokens, addToken]);

  const predefined = settings.apiTokens.filter((t) => !t.isCustom);
  const custom = settings.apiTokens.filter((t) => t.isCustom);

  function handleAddCustom() {
    if (!newKey.trim()) return;
    const token: ApiToken = {
      id: crypto.randomUUID(),
      key: newKey.trim().toUpperCase().replace(/\s+/g, "_"),
      value: "",
      description: newDesc.trim() || undefined,
      isCustom: true,
    };
    addToken(token);
    setNewKey("");
    setNewDesc("");
    setAdding(false);
  }

  return (
    <div className="space-y-6">
      {/* Predefined tokens */}
      <div className="space-y-3">
        <Label className="text-base font-medium">API Keys</Label>
        <p className="text-sm text-muted-foreground">
          Configure tokens for external service integrations. Values are stored
          locally on this device.
        </p>
        <div className="space-y-3">
          {predefined.map((token) => (
            <TokenRow
              key={token.id}
              token={token}
              onUpdate={updateToken}
              onRemove={removeToken}
            />
          ))}
        </div>
      </div>

      {/* Custom tokens */}
      <div className="space-y-3">
        <Label className="text-base font-medium">Custom Tokens</Label>
        {custom.length === 0 && !adding && (
          <p className="text-sm text-muted-foreground">
            No custom tokens configured.
          </p>
        )}
        <div className="space-y-3">
          {custom.map((token) => (
            <TokenRow
              key={token.id}
              token={token}
              onUpdate={updateToken}
              onRemove={removeToken}
            />
          ))}
        </div>

        {adding ? (
          <div className="rounded-lg border border-dashed p-4 space-y-3">
            <div className="space-y-2">
              <Label htmlFor="new-token-key" className="text-sm">
                Key name
              </Label>
              <Input
                id="new-token-key"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                placeholder="e.g. MY_API_KEY"
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-token-desc" className="text-sm">
                Description (optional)
              </Label>
              <Input
                id="new-token-desc"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="What is this token for?"
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAddCustom} disabled={!newKey.trim()}>
                Add
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setAdding(false);
                  setNewKey("");
                  setNewDesc("");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAdding(true)}
            className="gap-1.5"
          >
            <Plus className="h-4 w-4" />
            Add custom token
          </Button>
        )}
      </div>
    </div>
  );
}
