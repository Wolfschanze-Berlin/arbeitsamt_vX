"use client";

import { useState, useEffect } from "react";
import { PlusIcon, TrashIcon } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  CLOUD_CONNECTION_TYPES,
  CLOUD_ENVIRONMENTS,
  type CloudConnectionType,
  type CloudEnvironment,
  type ZentralCloudConnection,
} from "@/lib/zentral/types";

interface CloudConnectionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: ZentralCloudConnection | null;
  onSave: (conn: ZentralCloudConnection) => void;
}

type ConfigPair = { key: string; value: string };

function configToEntries(config: Record<string, string>): ConfigPair[] {
  return Object.entries(config).map(([key, value]) => ({ key, value }));
}

function entriesToConfig(pairs: ConfigPair[]): Record<string, string> {
  return Object.fromEntries(
    pairs.filter((p) => p.key.trim()).map((p) => [p.key.trim(), p.value]),
  );
}

export function CloudConnectionSheet({
  open,
  onOpenChange,
  initial,
  onSave,
}: CloudConnectionSheetProps) {
  const [type, setType] = useState<CloudConnectionType>("generic");
  const [label, setLabel] = useState("");
  const [environment, setEnvironment] = useState<CloudEnvironment>("production");
  const [url, setUrl] = useState("");
  const [exportEnabled, setExportEnabled] = useState(true);
  const [configPairs, setConfigPairs] = useState<ConfigPair[]>([]);

  useEffect(() => {
    if (open) {
      setType(initial?.type ?? "generic");
      setLabel(initial?.label ?? "");
      setEnvironment(initial?.environment ?? "production");
      setUrl(initial?.url ?? "");
      setExportEnabled(initial?.exportEnabled ?? true);
      setConfigPairs(
        initial?.config ? configToEntries(initial.config) : [],
      );
    }
  }, [open, initial]);

  function handleSave() {
    if (!label.trim()) return;
    onSave({
      id: initial?.id ?? crypto.randomUUID(),
      type,
      label: label.trim(),
      environment,
      url: url.trim() || undefined,
      exportEnabled,
      config: entriesToConfig(configPairs),
    });
    onOpenChange(false);
  }

  function addConfigPair() {
    setConfigPairs((prev) => [...prev, { key: "", value: "" }]);
  }

  function updateConfigPair(idx: number, field: "key" | "value", val: string) {
    setConfigPairs((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, [field]: val } : p)),
    );
  }

  function removeConfigPair(idx: number) {
    setConfigPairs((prev) => prev.filter((_, i) => i !== idx));
  }

  const isEditing = !!initial;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{isEditing ? "Edit Connection" : "Add Connection"}</SheetTitle>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
          {/* Type */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="conn-type">Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as CloudConnectionType)}>
              <SelectTrigger id="conn-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CLOUD_CONNECTION_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Label */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="conn-label">Label</Label>
            <Input
              id="conn-label"
              placeholder="e.g. Production RDS"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>

          {/* Environment */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="conn-env">Environment</Label>
            <Select
              value={environment}
              onValueChange={(v) => setEnvironment(v as CloudEnvironment)}
            >
              <SelectTrigger id="conn-env" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CLOUD_ENVIRONMENTS.map((e) => (
                  <SelectItem key={e} value={e}>
                    {e}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* URL */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="conn-url">URL (optional)</Label>
            <Input
              id="conn-url"
              placeholder="https://console.aws.amazon.com/..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>

          {/* Export toggle */}
          <div className="flex items-center justify-between rounded-md border px-3 py-2.5">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">Include in export</span>
              <span className="text-muted-foreground text-xs">
                Add to .zentral.json when exporting
              </span>
            </div>
            <Switch checked={exportEnabled} onCheckedChange={setExportEnabled} />
          </div>

          {/* Config key-value pairs */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label>Config metadata (optional)</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1 text-xs"
                onClick={addConfigPair}
              >
                <PlusIcon className="size-3" />
                Add
              </Button>
            </div>
            {configPairs.length === 0 && (
              <p className="text-muted-foreground text-xs">
                No metadata entries.
              </p>
            )}
            {configPairs.map((pair, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Input
                  placeholder="key"
                  value={pair.key}
                  onChange={(e) => updateConfigPair(idx, "key", e.target.value)}
                  className="h-8 text-xs"
                />
                <Input
                  placeholder="value"
                  value={pair.value}
                  onChange={(e) => updateConfigPair(idx, "value", e.target.value)}
                  className="h-8 text-xs"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0"
                  onClick={() => removeConfigPair(idx)}
                >
                  <TrashIcon className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        <SheetFooter className="border-t pt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="mr-auto"
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!label.trim()}>
            {isEditing ? "Save Changes" : "Add Connection"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
