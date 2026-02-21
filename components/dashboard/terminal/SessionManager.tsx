"use client";

import {
  useCallback,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { SessionTabs, type SessionTab, type SessionType } from "./SessionTabs";
import { TerminalView, type TerminalViewHandle } from "./TerminalView";
import type { SSHConnectParams } from "@/hooks/useSSHSession";
import { useTheme } from "@/context/theme-context";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Session extends SessionTab {
  /** Tauri-assigned session ID (set after connect succeeds). */
  tauriSessionId: string | null;
}

interface SessionManagerProps {
  /** Render prop / slot for a "new connection" UI (receives an open trigger). */
  renderConnectionDialog?: (props: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConnect: (params: SSHConnectParams & { label?: string; color?: string }) => void;
    isConnecting: boolean;
    error?: string;
  }) => ReactNode;
  className?: string;
}

// ---------------------------------------------------------------------------
// ID generator
// ---------------------------------------------------------------------------

let nextId = 1;
function generateSessionId(): string {
  return `session-${nextId++}-${Date.now().toString(36)}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function SessionManager({ renderConnectionDialog, className }: SessionManagerProps) {
  const { theme } = useTheme();

  // ---- Session state ----
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  // ---- Connection dialog state ----
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | undefined>();

  // ---- Refs for TerminalView handles (keyed by session id) ----
  const terminalRefs = useRef<Map<string, TerminalViewHandle | null>>(new Map());

  // Keep a ref to sessions for use in closures that should not re-render.
  const sessionsRef = useRef(sessions);
  sessionsRef.current = sessions;

  // ---- Per-session unlisten handles for disconnect events ----
  const unlistenRefs = useRef<Map<string, () => void>>(new Map());

  // ------------------------------------------------------------------
  // Terminal callbacks (stable via session ID closure)
  // ------------------------------------------------------------------

  const handleTerminalData = useCallback(
    (sessionId: string) => (data: Uint8Array) => {
      // Find the session to get its tauriSessionId
      const session = sessionsRef.current.find((s) => s.id === sessionId);
      if (!session?.tauriSessionId) return;

      // Use tauriInvoke directly for per-session write
      import("@/lib/tauri").then(({ tauriInvoke }) => {
        tauriInvoke("ssh_write", {
          sessionId: session.tauriSessionId,
          data: Array.from(data),
        }).catch(() => {
          // write failures are non-fatal (session may be closing)
        });
      });
    },
    [],
  );

  const handleTerminalResize = useCallback(
    (sessionId: string) => (cols: number, rows: number) => {
      const session = sessionsRef.current.find((s) => s.id === sessionId);
      if (!session?.tauriSessionId) return;

      import("@/lib/tauri").then(({ tauriInvoke }) => {
        tauriInvoke("ssh_resize", {
          sessionId: session.tauriSessionId,
          cols,
          rows,
        }).catch(() => {
          // resize failures are non-fatal
        });
      });
    },
    [],
  );

  // ------------------------------------------------------------------
  // Public API
  // ------------------------------------------------------------------

  const addSession = useCallback(
    (type: SessionType, label: string, color?: string): string => {
      const id = generateSessionId();
      const newSession: Session = {
        id,
        type,
        label,
        color,
        tauriSessionId: null,
      };

      setSessions((prev) => [...prev, newSession]);
      setActiveId(id);
      return id;
    },
    [],
  );

  const removeSession = useCallback(
    async (id: string) => {
      const session = sessionsRef.current.find((s) => s.id === id);

      // Disconnect SSH if connected
      if (session?.tauriSessionId) {
        try {
          const { tauriInvoke } = await import("@/lib/tauri");
          await tauriInvoke("ssh_disconnect", {
            sessionId: session.tauriSessionId,
          });
        } catch {
          // Already disconnected — fine
        }
      }

      // Clean up disconnect listener for this session
      unlistenRefs.current.get(id)?.();
      unlistenRefs.current.delete(id);

      // Clean up terminal ref
      terminalRefs.current.delete(id);

      setSessions((prev) => {
        const filtered = prev.filter((s) => s.id !== id);
        return filtered;
      });

      // If we removed the active session, activate the previous or next tab.
      setActiveId((currentActive) => {
        if (currentActive !== id) return currentActive;
        const remaining = sessionsRef.current.filter((s) => s.id !== id);
        if (remaining.length === 0) return null;
        // Try to pick the tab that was adjacent.
        const removedIndex = sessionsRef.current.findIndex((s) => s.id === id);
        const nextIndex = Math.min(removedIndex, remaining.length - 1);
        return remaining[nextIndex].id;
      });
    },
    [],
  );

  const handleSetActiveSession = useCallback((id: string) => {
    setActiveId(id);

    // After React renders, trigger a fit on the newly visible terminal
    // so xterm recalculates its dimensions.
    requestAnimationFrame(() => {
      const termEl = document.querySelector(
        `[data-session-id="${id}"]`,
      );
      if (termEl) {
        // Dispatch a synthetic resize so the ResizeObserver in TerminalView fires.
        window.dispatchEvent(new Event("resize"));
      }
    });
  }, []);

  // ------------------------------------------------------------------
  // Connection flow
  // ------------------------------------------------------------------

  const handleConnect = useCallback(
    async (params: SSHConnectParams & { label?: string; color?: string }) => {
      setIsConnecting(true);
      setConnectError(undefined);

      const label = params.label ?? `${params.username}@${params.host}`;
      const sessionLocalId = addSession("ssh", label, params.color);

      try {
        // Create a per-session Channel so each connection has its own
        // independent output stream — no shared state between sessions.
        const { Channel } = await import("@tauri-apps/api/core");
        const { tauriInvoke } = await import("@/lib/tauri");

        const outputChannel = new Channel<Uint8Array>();
        outputChannel.onmessage = (data: Uint8Array) => {
          const handle = terminalRefs.current.get(sessionLocalId);
          handle?.write(data);
        };

        // Build auth_method matching Rust's #[serde(tag = "method")] AuthMethod.
        let authMethod: Record<string, unknown>;
        switch (params.authMethod) {
          case "password":
            authMethod = { method: "password", password: params.password ?? "" };
            break;
          case "keyfile":
            authMethod = {
              method: "keyfile",
              key_path: params.keyPath ?? "",
              passphrase: params.passphrase ?? null,
            };
            break;
          case "agent":
            authMethod = { method: "agent" };
            break;
        }

        const tauriId = await tauriInvoke<string>("ssh_connect", {
          host: params.host,
          port: params.port,
          username: params.username,
          authMethod,
          cols: 80,
          rows: 24,
          output: outputChannel,
        });

        // Update the session with the Tauri-assigned ID.
        setSessions((prev) =>
          prev.map((s) =>
            s.id === sessionLocalId
              ? { ...s, tauriSessionId: tauriId }
              : s,
          ),
        );

        // Listen for unexpected disconnection for THIS session only.
        const { listen } = await import("@tauri-apps/api/event");
        const unlisten = await listen<{ sessionId: string; reason: string }>(
          "ssh_disconnected",
          (event) => {
            if (event.payload.sessionId === tauriId) {
              setSessions((prev) =>
                prev.map((s) =>
                  s.id === sessionLocalId
                    ? { ...s, tauriSessionId: null }
                    : s,
                ),
              );
            }
          },
        );
        unlistenRefs.current.set(sessionLocalId, unlisten);

        setDialogOpen(false);
      } catch (err) {
        // Remove the session we optimistically created.
        setSessions((prev) => prev.filter((s) => s.id !== sessionLocalId));
        setActiveId((current) =>
          current === sessionLocalId ? null : current,
        );
        let errorMsg = "Connection failed";
        if (err instanceof Error) {
          errorMsg = err.message;
        } else if (typeof err === "object" && err !== null && "message" in err) {
          errorMsg = String((err as { message: unknown }).message);
        } else if (typeof err === "string") {
          errorMsg = err;
        }
        setConnectError(errorMsg);
      } finally {
        setIsConnecting(false);
      }
    },
    [addSession],
  );

  const handleTabReorder = useCallback((reordered: SessionTab[]) => {
    setSessions((prev) => {
      // Preserve the full Session objects (with tauriSessionId) in new order.
      const sessionMap = new Map(prev.map((s) => [s.id, s]));
      return reordered
        .map((tab) => sessionMap.get(tab.id))
        .filter((s): s is Session => s !== undefined);
    });
  }, []);

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  return (
    <div className={cn("flex h-full flex-col", className)}>
      {/* Tab bar */}
      <SessionTabs
        tabs={sessions}
        activeId={activeId}
        onSelect={handleSetActiveSession}
        onClose={(id) => void removeSession(id)}
        onAdd={() => {
          setConnectError(undefined);
          setDialogOpen(true);
        }}
        onReorder={handleTabReorder}
      />

      {/* Terminal panels — ALL mounted, only active is visible */}
      <div className="relative flex-1">
        {sessions.length === 0 && (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No active sessions. Click + to connect.
          </div>
        )}

        {sessions.map((session) => (
          <div
            key={session.id}
            className="absolute inset-0"
            style={{
              display: session.id === activeId ? "block" : "none",
            }}
          >
            <TerminalView
              ref={(handle) => {
                if (handle) {
                  terminalRefs.current.set(session.id, handle);
                } else {
                  terminalRefs.current.delete(session.id);
                }
              }}
              sessionId={session.id}
              theme={theme}
              onData={handleTerminalData(session.id)}
              onResize={handleTerminalResize(session.id)}
            />
          </div>
        ))}
      </div>

      {/* Connection dialog — only mount when open to avoid idle hook overhead */}
      {dialogOpen && renderConnectionDialog?.({
        open: dialogOpen,
        onOpenChange: setDialogOpen,
        onConnect: handleConnect,
        isConnecting,
        error: connectError,
      })}
    </div>
  );
}

export { SessionManager };
export type { SessionManagerProps };
