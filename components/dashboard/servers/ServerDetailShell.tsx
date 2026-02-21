"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, RefreshCw } from "lucide-react";

import { tauriInvoke } from "@/lib/tauri";
import { ServerDetailTabs } from "@/components/dashboard/servers/ServerDetailTabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ResolvedSshConfig {
  hostname: string;
  port: number;
  user: string | null;
  identityFile: string | null;
  proxyJump: string | null;
}

interface SshSession {
  sessionId: string;
  host: string;
  port: number;
  username: string;
}

type ConnectionState =
  | { status: "idle" }
  | { status: "connecting" }
  | { status: "connected"; sessionId: string }
  | { status: "auth-failed"; host: string; port: number; username: string; reason: string }
  | { status: "error"; message: string };

// ---------------------------------------------------------------------------
// Auth-failed form schema
// ---------------------------------------------------------------------------

const passwordSchema = z.object({
  host: z.string().min(1, "Host is required"),
  port: z
    .number()
    .int()
    .min(1, "Port must be between 1 and 65535")
    .max(65535, "Port must be between 1 and 65535"),
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

type PasswordFormValues = z.infer<typeof passwordSchema>;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ServerDetailShellProps {
  host: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function ServerDetailShell({ host }: ServerDetailShellProps) {
  const [connState, setConnState] = useState<ConnectionState>({
    status: "idle",
  });

  // Track whether WE created the session (vs. reusing an existing one)
  // so we only disconnect on unmount if we own the session.
  const ownedSessionRef = useRef(false);
  const sessionIdRef = useRef<string | null>(null);

  // ------------------------------------------------------------------
  // Connect with key-based auth (auto-connect on mount)
  // ------------------------------------------------------------------

  const connectWithKey = useCallback(
    async (config: ResolvedSshConfig) => {
      setConnState({ status: "connecting" });

      try {
        const { Channel } = await import("@tauri-apps/api/core");

        const outputChannel = new Channel<Uint8Array>();
        // The server detail page does not render a terminal, so output
        // from this connection is intentionally discarded. The session
        // is used for ssh_exec / ssh_get_metrics commands only.
        outputChannel.onmessage = () => {};

        const sessionId = await tauriInvoke<string>("ssh_connect", {
          host: config.hostname,
          port: config.port,
          username: config.user ?? "root",
          authMethod: {
            method: "auto",
            identity_file: config.identityFile ?? null,
          },
          cols: 80,
          rows: 24,
          output: outputChannel,
        });

        ownedSessionRef.current = true;
        sessionIdRef.current = sessionId;
        setConnState({ status: "connected", sessionId });
      } catch (err) {
        const message = extractErrorMessage(err);

        // If the error looks like an auth failure, transition to auth-failed
        // so the user can provide a password.
        if (isAuthError(message)) {
          setConnState({
            status: "auth-failed",
            host: config.hostname,
            port: config.port,
            username: config.user ?? "root",
            reason: message,
          });
        } else {
          setConnState({ status: "error", message });
        }
      }
    },
    [],
  );

  // ------------------------------------------------------------------
  // Connect with password (from auth-failed form)
  // ------------------------------------------------------------------

  const connectWithPassword = useCallback(
    async (values: PasswordFormValues) => {
      setConnState({ status: "connecting" });

      try {
        const { Channel } = await import("@tauri-apps/api/core");

        const outputChannel = new Channel<Uint8Array>();
        outputChannel.onmessage = () => {};

        const sessionId = await tauriInvoke<string>("ssh_connect", {
          host: values.host,
          port: values.port,
          username: values.username,
          authMethod: { method: "password", password: values.password },
          cols: 80,
          rows: 24,
          output: outputChannel,
        });

        ownedSessionRef.current = true;
        sessionIdRef.current = sessionId;
        setConnState({ status: "connected", sessionId });
      } catch (err) {
        const message = extractErrorMessage(err);
        if (isAuthError(message)) {
          setConnState({
            status: "auth-failed",
            host: values.host,
            port: values.port,
            username: values.username,
            reason: message,
          });
        } else {
          setConnState({ status: "error", message });
        }
      }
    },
    [],
  );

  // ------------------------------------------------------------------
  // Resolve + check sessions + auto-connect
  // ------------------------------------------------------------------

  const resolveAndConnect = useCallback(
    async () => {
      try {
        const config = await tauriInvoke<ResolvedSshConfig>(
          "ssh_resolve_config",
          { host },
        );

        const sessions = await tauriInvoke<SshSession[]>("ssh_list_sessions");
        const existing = sessions.find(
          (s) =>
            s.host === config.hostname &&
            s.port === config.port &&
            s.username === (config.user ?? "root"),
        );

        if (existing) {
          ownedSessionRef.current = false;
          sessionIdRef.current = existing.sessionId;
          setConnState({ status: "connected", sessionId: existing.sessionId });
          return;
        }

        await connectWithKey(config);
      } catch (err) {
        setConnState({ status: "error", message: extractErrorMessage(err) });
      }
    },
    [host, connectWithKey],
  );

  // ------------------------------------------------------------------
  // Mount: resolve config -> check existing sessions -> auto-connect
  // ------------------------------------------------------------------

  useEffect(() => {
    let cancelled = false;

    async function init() {
      await resolveAndConnect();
    }

    init().then(() => {
      if (cancelled) {
        // If unmounted during init, we may have set state — this is harmless
        // because React ignores state updates on unmounted components.
      }
    });

    return () => {
      cancelled = true;
    };
  }, [resolveAndConnect]);

  // ------------------------------------------------------------------
  // Cleanup: disconnect on unmount if we own the session
  // ------------------------------------------------------------------

  useEffect(() => {
    return () => {
      if (ownedSessionRef.current && sessionIdRef.current) {
        tauriInvoke("ssh_disconnect", {
          sessionId: sessionIdRef.current,
        }).catch(() => {
          // Session may already be closed — fine
        });
      }
    };
  }, []);

  // ------------------------------------------------------------------
  // Retry handler (for error state)
  // ------------------------------------------------------------------

  const handleRetry = useCallback(() => {
    setConnState({ status: "idle" });
    resolveAndConnect();
  }, [resolveAndConnect]);

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  switch (connState.status) {
    case "idle":
      return <IdleState />;

    case "connecting":
      return <ConnectingState host={host} />;

    case "connected":
      return (
        <ServerDetailTabs sessionId={connState.sessionId} host={host} />
      );

    case "auth-failed":
      return (
        <AuthFailedState
          host={connState.host}
          port={connState.port}
          username={connState.username}
          reason={connState.reason}
          onSubmit={connectWithPassword}
        />
      );

    case "error":
      return (
        <ErrorState message={connState.message} onRetry={handleRetry} />
      );
  }
}

// ---------------------------------------------------------------------------
// Sub-components for each state
// ---------------------------------------------------------------------------

function IdleState() {
  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}

function ConnectingState({ host }: { host: string }) {
  return (
    <div className="flex h-full min-h-[400px] flex-col items-center justify-center gap-3">
      <Spinner className="size-6" />
      <p className="text-muted-foreground text-sm">
        Connecting to{" "}
        <span className="text-foreground font-medium">{host}</span>&hellip;
      </p>
    </div>
  );
}

function AuthFailedState({
  host,
  port,
  username,
  reason,
  onSubmit,
}: {
  host: string;
  port: number;
  username: string;
  reason: string;
  onSubmit: (values: PasswordFormValues) => void;
}) {
  const form = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { host, port, username, password: "" },
  });

  return (
    <div className="flex h-full min-h-[400px] items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="text-destructive size-5" />
            <CardTitle>Authentication Failed</CardTitle>
          </div>
          <CardDescription>
            Auto key-based authentication failed. You can try with a password
            below.
          </CardDescription>
          {reason && (
            <pre className="bg-muted mt-2 max-h-24 overflow-auto rounded-md p-2 font-mono text-xs">
              {reason}
            </pre>
          )}
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="grid gap-4"
            >
              <div className="grid grid-cols-[1fr_100px] gap-3">
                <FormField
                  control={form.control}
                  name="host"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Host</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="port"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Port</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          max={65535}
                          {...field}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value === ""
                                ? undefined
                                : Number(e.target.value),
                            )
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="Enter password"
                        autoFocus
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="mt-2 w-full">
                Connect
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex h-full min-h-[400px] items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="text-destructive size-5" />
            <CardTitle>Connection Failed</CardTitle>
          </div>
          <CardDescription>{message}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={onRetry} variant="outline" className="gap-1.5">
            <RefreshCw className="size-4" />
            Retry
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err !== null && "message" in err) {
    return String((err as { message: unknown }).message);
  }
  if (typeof err === "string") return err;
  return "An unknown error occurred";
}

function isAuthError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("auth") ||
    lower.includes("permission denied") ||
    lower.includes("password") ||
    lower.includes("publickey")
  );
}

export { ServerDetailShell };
export type { ServerDetailShellProps, ConnectionState };
