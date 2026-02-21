"use client";

import { useCallback, useRef, useState } from "react";
import { tauriInvoke } from "@/lib/tauri";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SSHConnectParams {
  host: string;
  port: number;
  username: string;
  authMethod: "password" | "keyfile" | "agent";
  password?: string;
  keyPath?: string;
  passphrase?: string;
}

interface UseSSHSessionOptions {
  /** Called when binary output arrives from the remote host. */
  onOutput?: (data: Uint8Array) => void;
  /** Called when the connection drops unexpectedly. */
  onDisconnect?: (reason: string) => void;
}

interface UseSSHSessionReturn {
  /** Open an SSH connection. Resolves with the session ID assigned by Tauri. */
  connect: (params: SSHConnectParams) => Promise<string>;
  /** Send raw bytes to the remote PTY stdin. */
  write: (data: Uint8Array) => Promise<void>;
  /** Notify the remote PTY of a terminal resize. */
  resize: (cols: number, rows: number) => Promise<void>;
  /** Gracefully disconnect the session. */
  disconnect: () => Promise<void>;
  /** Whether there is an active connection. */
  isConnected: boolean;
  /** Current Tauri-assigned session ID (null when disconnected). */
  sessionId: string | null;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSSHSession(
  options: UseSSHSessionOptions = {},
): UseSSHSessionReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Stable refs for callbacks so we never re-create the Channel unnecessarily.
  const onOutputRef = useRef(options.onOutput);
  onOutputRef.current = options.onOutput;

  const onDisconnectRef = useRef(options.onDisconnect);
  onDisconnectRef.current = options.onDisconnect;

  // Keep an unlisten handle so we can clean up the event listener.
  const unlistenRef = useRef<(() => void) | null>(null);

  // ------------------------------------------------------------------
  // connect
  // ------------------------------------------------------------------

  const connect = useCallback(async (params: SSHConnectParams): Promise<string> => {
    // Dynamically import Channel from Tauri core — this is the streaming
    // primitive that lets Rust push data to the frontend callback.
    const { Channel } = await import("@tauri-apps/api/core");

    const outputChannel = new Channel<Uint8Array>();
    outputChannel.onmessage = (data: Uint8Array) => {
      onOutputRef.current?.(data);
    };

    // Build the auth_method as an internally tagged enum matching Rust's
    // #[serde(tag = "method")] AuthMethod.
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

    const id = await tauriInvoke<string>("ssh_connect", {
      host: params.host,
      port: params.port,
      username: params.username,
      authMethod,
      cols: 80,
      rows: 24,
      output: outputChannel,
    });

    setSessionId(id);
    setIsConnected(true);

    // Listen for unexpected disconnections from the backend.
    const { listen } = await import("@tauri-apps/api/event");
    const unlisten = await listen<{ sessionId: string; reason: string }>(
      "ssh_disconnected",
      (event) => {
        if (event.payload.sessionId === id) {
          setIsConnected(false);
          setSessionId(null);
          onDisconnectRef.current?.(event.payload.reason);
        }
      },
    );
    unlistenRef.current = unlisten;

    return id;
  }, []);

  // ------------------------------------------------------------------
  // write
  // ------------------------------------------------------------------

  const write = useCallback(
    async (data: Uint8Array) => {
      if (!sessionId) return;
      await tauriInvoke("ssh_write", {
        sessionId,
        data: Array.from(data),
      });
    },
    [sessionId],
  );

  // ------------------------------------------------------------------
  // resize
  // ------------------------------------------------------------------

  const resize = useCallback(
    async (cols: number, rows: number) => {
      if (!sessionId) return;
      await tauriInvoke("ssh_resize", {
        sessionId,
        cols,
        rows,
      });
    },
    [sessionId],
  );

  // ------------------------------------------------------------------
  // disconnect
  // ------------------------------------------------------------------

  const disconnect = useCallback(async () => {
    if (!sessionId) return;

    // Clean up the event listener first.
    unlistenRef.current?.();
    unlistenRef.current = null;

    try {
      await tauriInvoke("ssh_disconnect", { sessionId });
    } catch {
      // Session may already be closed on the Rust side — that is fine.
    }

    setIsConnected(false);
    setSessionId(null);
  }, [sessionId]);

  return { connect, write, resize, disconnect, isConnected, sessionId };
}

export type { SSHConnectParams, UseSSHSessionReturn };
