"use client";

import { useState } from "react";
import { useSettings } from "@/context/settings-context";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { tauriInvoke } from "@/lib/tauri";
import { RefreshCw, ExternalLink } from "lucide-react";

export function UpdatesSettings() {
  const { settings, updateCheckUpdatesOnLaunch } = useSettings();
  const [checking, setChecking] = useState(false);
  const [updateResult, setUpdateResult] = useState<string | null>(null);

  async function handleCheckUpdate() {
    setChecking(true);
    setUpdateResult(null);
    try {
      const result = await tauriInvoke<{ available: boolean; version?: string }>(
        "plugin:updater|check",
      );
      setUpdateResult(
        result.available
          ? `Update available: v${result.version}`
          : "You're on the latest version",
      );
    } catch {
      setUpdateResult("Could not check for updates");
    } finally {
      setChecking(false);
    }
  }

  async function handleOpenGithub() {
    try {
      await tauriInvoke("plugin:opener|open_url", {
        url: "https://github.com/Wolfschanze-Berlin/arbeitsamt_vX",
      });
    } catch {
      window.open(
        "https://github.com/Wolfschanze-Berlin/arbeitsamt_vX",
        "_blank",
      );
    }
  }

  return (
    <div className="space-y-6">
      {/* Auto-check updates */}
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-base font-medium">
            Check for updates on launch
          </Label>
          <p className="text-xs text-muted-foreground">
            Automatically check when the app starts
          </p>
        </div>
        <Switch
          checked={settings.checkUpdatesOnLaunch}
          onCheckedChange={updateCheckUpdatesOnLaunch}
        />
      </div>

      {/* Manual check */}
      <div className="space-y-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleCheckUpdate}
          disabled={checking}
        >
          <RefreshCw className={`mr-2 size-4 ${checking ? "animate-spin" : ""}`} />
          {checking ? "Checking..." : "Check Now"}
        </Button>
        {updateResult && (
          <p className="text-sm text-muted-foreground">{updateResult}</p>
        )}
      </div>

      <Separator />

      {/* About */}
      <div className="space-y-3">
        <h4 className="text-base font-medium">About</h4>
        <div className="space-y-1 text-sm text-muted-foreground">
          <p>
            <span className="font-medium text-foreground">arbeitsamt_vX</span>
          </p>
          <p>Desktop application built with Tauri 2 + Next.js 16</p>
        </div>
        <Button variant="ghost" size="sm" onClick={handleOpenGithub}>
          <ExternalLink className="mr-2 size-4" />
          View on GitHub
        </Button>
      </div>
    </div>
  );
}
