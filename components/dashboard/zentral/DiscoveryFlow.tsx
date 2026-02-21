"use client";

import { useState, useEffect, useCallback } from "react";
import { FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { tauriInvoke } from "@/lib/tauri";
import { useZentral } from "@/context/ZentralContext";
import type { ZentralProjectEntry } from "@/lib/zentral/types";
import { DiscoveryScanRoots } from "./DiscoveryScanRoots";
import { DiscoveryScanResults, type ScanRepoInfo } from "./DiscoveryScanResults";
import { DiscoveryImport } from "./DiscoveryImport";

type Step = "roots" | "scan" | "import" | "done";

const SCAN_ROOTS_KEY = "zentral_scan_roots";

interface LocalPathInfo {
  path: string;
  name: string;
  remote_url: string | null;
  repo_full_name: string | null;
  has_zentral_config: boolean;
  zentral_config: unknown | null;
}

async function openDirPicker(): Promise<string | null> {
  if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) return null;
  const { open } = await import("@tauri-apps/plugin-dialog");
  const result = await open({ directory: true, multiple: false });
  return result ?? null;
}

async function loadSavedRoots(): Promise<string[]> {
  try {
    if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) return [];
    const { LazyStore } = await import("@tauri-apps/plugin-store");
    const store = new LazyStore("zentral.json");
    return (await store.get<string[]>(SCAN_ROOTS_KEY)) ?? [];
  } catch {
    return [];
  }
}

async function saveScanRoots(roots: string[]): Promise<void> {
  try {
    if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) return;
    const { LazyStore } = await import("@tauri-apps/plugin-store");
    const store = new LazyStore("zentral.json");
    await store.set(SCAN_ROOTS_KEY, roots);
    await store.save();
  } catch {
    // non-critical
  }
}

interface Props {
  onDone?: () => void;
}

export function DiscoveryFlow({ onDone }: Props) {
  const { addOrUpdateProject } = useZentral();
  const [step, setStep] = useState<Step>("roots");
  const [roots, setRoots] = useState<string[]>([]);
  const [scannedRepos, setScannedRepos] = useState<ScanRepoInfo[]>([]);

  // Load previously saved roots on mount
  useEffect(() => {
    loadSavedRoots().then((saved) => {
      if (saved.length > 0) setRoots(saved);
    });
  }, []);

  // Drag-and-drop: listen for files dropped onto the webview
  useEffect(() => {
    const setup = async () => {
      if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) return () => {};
      const { getCurrentWebviewWindow } = await import("@tauri-apps/api/webviewWindow");
      const webview = getCurrentWebviewWindow();
      const unlisten = await webview.onDragDropEvent(async (event) => {
        if (event.payload.type !== "drop") return;
        const paths: string[] = event.payload.paths ?? [];
        for (const p of paths) {
          try {
            const info = await tauriInvoke<LocalPathInfo>("zentral_import_local_path", { path: p });
            const entry: ZentralProjectEntry = {
              id: crypto.randomUUID(),
              canonicalId: info.repo_full_name ?? info.path,
              name: info.name,
              localPath: info.path,
              remoteUrl: info.remote_url,
              repoFullName: info.repo_full_name,
              config: null,
              importedAt: new Date().toISOString(),
            };
            await addOrUpdateProject(entry);
          } catch {
            // skip non-git drops
          }
        }
      });
      return unlisten;
    };

    let cleanup: (() => void) | undefined;
    setup().then((fn) => { cleanup = fn; });
    return () => { cleanup?.(); };
  }, [addOrUpdateProject]);

  const handleRootsNext = useCallback(async (newRoots: string[]) => {
    await saveScanRoots(newRoots);
    setRoots(newRoots);
    setStep("scan");
  }, []);

  const handleScanComplete = useCallback((repos: ScanRepoInfo[]) => {
    setScannedRepos(repos);
    setStep("import");
  }, []);

  async function handleManualPick() {
    const dir = await openDirPicker();
    if (!dir) return;
    try {
      const info = await tauriInvoke<LocalPathInfo>("zentral_import_local_path", { path: dir });
      const entry: ZentralProjectEntry = {
        id: crypto.randomUUID(),
        canonicalId: info.repo_full_name ?? info.path,
        name: info.name,
        localPath: info.path,
        remoteUrl: info.remote_url,
        repoFullName: info.repo_full_name,
        config: null,
        importedAt: new Date().toISOString(),
      };
      await addOrUpdateProject(entry);
      onDone?.();
    } catch {
      // not a git repo, ignore
    }
  }

  return (
    <div className="mx-auto w-full max-w-lg">
      {/* Manual / drag-drop hint */}
      {step === "roots" && (
        <div className="text-muted-foreground mb-4 flex items-center justify-center gap-2 text-xs">
          <span>Or</span>
          <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={handleManualPick}>
            <FolderOpen className="mr-1 size-3.5" />
            pick a folder
          </Button>
          <span>/ drag &amp; drop a repo here</span>
        </div>
      )}

      <Card>
        <CardContent className="pt-6">
          {step === "roots" && (
            <DiscoveryScanRoots
              roots={roots}
              onRootsChange={setRoots}
              onNext={() => handleRootsNext(roots)}
            />
          )}
          {step === "scan" && (
            <DiscoveryScanResults
              roots={roots}
              onComplete={handleScanComplete}
              onBack={() => setStep("roots")}
            />
          )}
          {step === "import" && (
            <DiscoveryImport
              repos={scannedRepos}
              onDone={() => { onDone?.(); }}
              onBack={() => setStep("scan")}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
