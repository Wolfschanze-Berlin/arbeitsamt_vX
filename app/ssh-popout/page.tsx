"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { TerminalView, type TerminalViewHandle } from "@/components/dashboard/terminal/TerminalView";
import { useTheme } from "@/context/theme-context";

/**
 * Standalone SSH terminal page for pop-out windows.
 *
 * Opened by `SessionManager.popOutSession()` in a new Tauri WebviewWindow.
 * Receives the session ID via URL search params, creates a fresh output
 * Channel, and calls `ssh_reattach_output` so the Rust backend streams
 * data directly to this window.
 */
function SshPopoutContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");
  const label = searchParams.get("label") ?? "SSH";
  const { theme } = useTheme();

  const terminalRef = useRef<TerminalViewHandle | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Wire up the SSH output channel and reattach on mount
  useEffect(() => {
    if (!sessionId) {
      setError("No sessionId provided");
      return;
    }

    let disposed = false;

    (async () => {
      try {
        const { Channel } = await import("@tauri-apps/api/core");
        const { tauriInvoke } = await import("@/lib/tauri");

        // Create a new output channel for this window
        const outputChannel = new Channel<Uint8Array>();
        outputChannel.onmessage = (data: Uint8Array) => {
          terminalRef.current?.write(data);
        };

        // Tell the Rust backend to send output here instead
        await tauriInvoke("ssh_reattach_output", {
          sessionId,
          output: outputChannel,
        });

        if (!disposed) setReady(true);

        // Set window title
        try {
          const { getCurrentWebviewWindow } = await import(
            "@tauri-apps/api/webviewWindow"
          );
          const win = getCurrentWebviewWindow();
          await win.setTitle(label);
        } catch {
          // title-setting not critical
        }
      } catch (err) {
        if (!disposed) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    })();

    // On window close, disconnect the SSH session
    let unlisten: (() => void) | undefined;
    (async () => {
      try {
        const { getCurrentWebviewWindow } = await import(
          "@tauri-apps/api/webviewWindow"
        );
        const win = getCurrentWebviewWindow();
        unlisten = await win.onCloseRequested(async () => {
          try {
            const { tauriInvoke } = await import("@/lib/tauri");
            await tauriInvoke("ssh_disconnect", { sessionId });
          } catch {
            // session may already be disconnected
          }
        });
      } catch {
        // not in Tauri
      }
    })();

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [sessionId, label]);

  const handleData = (data: Uint8Array) => {
    if (!sessionId) return;
    import("@/lib/tauri").then(({ tauriInvoke }) => {
      tauriInvoke("ssh_write", {
        sessionId,
        data: Array.from(data),
      }).catch(() => {});
    });
  };

  const handleResize = (cols: number, rows: number) => {
    if (!sessionId) return;
    import("@/lib/tauri").then(({ tauriInvoke }) => {
      tauriInvoke("ssh_resize", { sessionId, cols, rows }).catch(() => {});
    });
  };

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-destructive">
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  if (!sessionId) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-muted-foreground">
        <p className="text-sm">Missing session ID</p>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-background">
      {ready && (
        <TerminalView
          ref={(handle) => {
            terminalRef.current = handle;
          }}
          sessionId={`popout-${sessionId}`}
          theme={theme}
          onData={handleData}
          onResize={handleResize}
        />
      )}
    </div>
  );
}

export default function SshPopoutPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-background text-muted-foreground">
          <p className="text-sm">Loading...</p>
        </div>
      }
    >
      <SshPopoutContent />
    </Suspense>
  );
}
