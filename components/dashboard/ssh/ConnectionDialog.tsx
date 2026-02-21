"use client";

import * as React from "react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { FolderOpen, Server } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { useSettings } from "@/context/settings-context";
import { PROFILE_COLOR_TAGS } from "@/lib/settings";
import { Settings2 } from "lucide-react";
import Link from "next/link";

interface ResolvedSshConfig {
  hostname: string;
  port: number;
  user: string | null;
  identityFile: string | null;
  proxyJump: string | null;
}

const authMethods = ["password", "keyfile", "agent"] as const;

const connectionSchema = z
  .object({
    host: z.string().min(1, "Host is required"),
    port: z
      .number()
      .int("Port must be an integer")
      .min(1, "Port must be between 1 and 65535")
      .max(65535, "Port must be between 1 and 65535"),
    username: z.string().min(1, "Username is required"),
    authMethod: z.enum(authMethods),
    password: z.string().optional(),
    keyPath: z.string().optional(),
    passphrase: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.authMethod === "password" && !data.password) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Password is required",
        path: ["password"],
      });
    }
    if (data.authMethod === "keyfile" && !data.keyPath) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Key file path is required",
        path: ["keyPath"],
      });
    }
  });

type ConnectionFormValues = z.infer<typeof connectionSchema>;

interface ConnectionParams {
  host: string;
  port: number;
  username: string;
  authMethod: "password" | "keyfile" | "agent";
  password?: string;
  keyPath?: string;
  passphrase?: string;
}

interface ConnectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnect: (params: ConnectionParams) => void;
  isConnecting?: boolean;
  error?: string;
  /** Pre-select a saved profile by ID */
  profileId?: string;
  /** SSH config alias to auto-resolve and pre-fill on open (from URL ?host=). */
  initialHost?: string;
}

function ConnectionDialog({
  open,
  onOpenChange,
  onConnect,
  isConnecting = false,
  error,
  profileId,
  initialHost,
}: ConnectionDialogProps) {
  const { settings } = useSettings();
  const [configHosts, setConfigHosts] = useState<string[]>([]);
  const [loadingHosts, setLoadingHosts] = useState(false);

  const form = useForm<ConnectionFormValues>({
    resolver: zodResolver(connectionSchema),
    defaultValues: {
      host: "",
      port: 22,
      username: "",
      authMethod: "keyfile",
      password: "",
      keyPath: "",
      passphrase: "",
    },
  });

  const authMethod = form.watch("authMethod");
  const savedProfiles = settings.sshProfiles;

  // Pre-fill form from a saved profile
  useEffect(() => {
    if (!open || !profileId) return;
    const profile = savedProfiles.find((p) => p.id === profileId);
    if (!profile) return;
    form.setValue("host", profile.host, { shouldValidate: true });
    form.setValue("port", profile.port, { shouldValidate: true });
    form.setValue("username", profile.username, { shouldValidate: true });
    form.setValue("authMethod", profile.authMethod.method, { shouldValidate: true });
    if (profile.authMethod.method === "keyfile") {
      form.setValue("keyPath", profile.authMethod.keyPath, { shouldValidate: true });
    }
  }, [open, profileId, savedProfiles, form]);

  // Auto-resolve an SSH alias passed via URL ?host= param
  useEffect(() => {
    if (!open || !initialHost) return;
    let cancelled = false;

    async function resolveInitialHost() {
      try {
        const { tauriInvoke } = await import("@/lib/tauri");
        const config = await tauriInvoke<ResolvedSshConfig>("ssh_resolve_config", { host: initialHost });
        if (cancelled) return;

        form.setValue("host", config.hostname, { shouldValidate: true });
        form.setValue("port", config.port, { shouldValidate: true });
        if (config.user) {
          form.setValue("username", config.user, { shouldValidate: true });
        }

        const keyPath = config.identityFile ?? await discoverDefaultKey();
        if (keyPath) {
          form.setValue("authMethod", "keyfile");
          form.setValue("keyPath", keyPath, { shouldValidate: true });
        }
      } catch {
        // Resolve failed — fill alias as hostname fallback
        if (!cancelled) {
          form.setValue("host", initialHost!, { shouldValidate: true });
        }
      }
    }

    resolveInitialHost();
    return () => { cancelled = true; };
  }, [open, initialHost, form]);

  function handleProfileQuickConnect(id: string) {
    const profile = savedProfiles.find((p) => p.id === id);
    if (!profile) return;
    const params: ConnectionParams = {
      host: profile.host,
      port: profile.port,
      username: profile.username,
      authMethod: profile.authMethod.method,
    };
    if (profile.authMethod.method === "keyfile") {
      params.keyPath = profile.authMethod.keyPath;
    }
    onConnect(params);
  }

  // Load SSH config hosts and discover default key when dialog opens
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    async function loadHostsAndKey() {
      setLoadingHosts(true);
      try {
        const { tauriInvoke } = await import("@/lib/tauri");

        // Load config hosts and discover default key in parallel
        const [hosts, keys] = await Promise.all([
          tauriInvoke<string[]>("ssh_list_config_hosts").catch(() => [] as string[]),
          tauriInvoke<string[]>("ssh_discover_keys").catch(() => [] as string[]),
        ]);

        if (cancelled) return;
        setConfigHosts(hosts);

        // Pre-fill default key if keyfile auth is selected and no key set yet
        if (keys.length > 0 && !form.getValues("keyPath")) {
          form.setValue("keyPath", keys[0]);
        }
      } catch {
        // Not in Tauri — silently ignore
      } finally {
        if (!cancelled) setLoadingHosts(false);
      }
    }

    loadHostsAndKey();
    return () => { cancelled = true; };
  }, [open, form]);

  // Discover the first available default SSH key from ~/.ssh/
  async function discoverDefaultKey(): Promise<string | null> {
    try {
      const { tauriInvoke } = await import("@/lib/tauri");
      const keys = await tauriInvoke<string[]>("ssh_discover_keys");
      return keys.length > 0 ? keys[0] : null;
    } catch {
      return null;
    }
  }

  // Auto-fill form when an SSH config host is selected
  async function handleConfigHostSelect(alias: string) {
    if (alias === "_manual") return;
    try {
      const { tauriInvoke } = await import("@/lib/tauri");
      const config = await tauriInvoke<ResolvedSshConfig>("ssh_resolve_config", { host: alias });

      form.setValue("host", config.hostname, { shouldValidate: true });
      form.setValue("port", config.port, { shouldValidate: true });
      if (config.user) {
        form.setValue("username", config.user, { shouldValidate: true });
      }

      // Use identity file from config, or discover default key
      const keyPath = config.identityFile ?? await discoverDefaultKey();
      if (keyPath) {
        form.setValue("authMethod", "keyfile");
        form.setValue("keyPath", keyPath, { shouldValidate: true });
      }
    } catch {
      // resolve failed — just fill alias as hostname
      form.setValue("host", alias, { shouldValidate: true });
    }
  }

  function onSubmit(values: ConnectionFormValues) {
    const params: ConnectionParams = {
      host: values.host,
      port: values.port,
      username: values.username,
      authMethod: values.authMethod,
    };

    if (values.authMethod === "password") {
      params.password = values.password;
    } else if (values.authMethod === "keyfile") {
      params.keyPath = values.keyPath;
      if (values.passphrase) {
        params.passphrase = values.passphrase;
      }
    }

    onConnect(params);
  }

  async function handleBrowseKeyFile() {
    try {
      const { open: openDialog } = await import("@tauri-apps/plugin-dialog");
      const selected = await openDialog({
        multiple: false,
        title: "Select SSH Key File",
        filters: [{ name: "All Files", extensions: ["*"] }],
      });
      if (typeof selected === "string") {
        form.setValue("keyPath", selected, { shouldValidate: true });
      }
    } catch {
      // Tauri dialog not available (e.g. dev mode in browser)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>SSH Connection</DialogTitle>
          <DialogDescription>
            Enter the connection details for the remote host.
          </DialogDescription>
        </DialogHeader>

        {/* Saved Profiles Quick Connect */}
        {savedProfiles.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm text-muted-foreground">Saved Profiles</Label>
              <Button variant="ghost" size="sm" asChild className="h-auto p-0 text-xs text-muted-foreground">
                <Link href="/settings">
                  <Settings2 className="mr-1 size-3" />
                  Manage
                </Link>
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {savedProfiles.map((profile) => {
                const colorTag = PROFILE_COLOR_TAGS.find((t) => t.value === profile.colorTag);
                return (
                  <Button
                    key={profile.id}
                    variant="outline"
                    size="sm"
                    disabled={isConnecting}
                    onClick={() => handleProfileQuickConnect(profile.id)}
                    className="gap-1.5"
                  >
                    <span className={`size-2 rounded-full ${colorTag?.className ?? "bg-muted-foreground"}`} />
                    {profile.name}
                  </Button>
                );
              })}
            </div>
            <Separator />
          </div>
        )}

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="grid gap-4"
          >
            {/* SSH config host picker */}
            {configHosts.length > 0 && (
              <div>
                <Label className="mb-2 block text-sm">SSH Config Hosts</Label>
                <Select
                  disabled={isConnecting || loadingHosts}
                  onValueChange={handleConfigHostSelect}
                >
                  <SelectTrigger>
                    <div className="flex items-center gap-2">
                      <Server className="size-4 text-muted-foreground" />
                      <SelectValue placeholder="Select from ~/.ssh/config" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {configHosts.map((host) => (
                      <SelectItem key={host} value={host}>
                        {host}
                      </SelectItem>
                    ))}
                    <SelectItem value="_manual">Enter manually...</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Host and Port row */}
            <div className="grid grid-cols-[1fr_100px] gap-3">
              <FormField
                control={form.control}
                name="host"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Host</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="192.168.1.1"
                        disabled={isConnecting}
                        {...field}
                      />
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
                        disabled={isConnecting}
                        {...field}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value === ""
                              ? undefined
                              : Number(e.target.value)
                          )
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Username */}
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Username</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="root"
                      disabled={isConnecting}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Auth method */}
            <FormField
              control={form.control}
              name="authMethod"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Authentication</FormLabel>
                  <FormControl>
                    <RadioGroup
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={isConnecting}
                      className="grid grid-cols-3 gap-3"
                    >
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="password" id="auth-password" />
                        <Label htmlFor="auth-password" className="cursor-pointer">
                          Password
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="keyfile" id="auth-keyfile" />
                        <Label htmlFor="auth-keyfile" className="cursor-pointer">
                          Key File
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="agent" id="auth-agent" />
                        <Label htmlFor="auth-agent" className="cursor-pointer">
                          SSH Agent
                        </Label>
                      </div>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Password field (shown when auth=password) */}
            {authMethod === "password" && (
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
                        disabled={isConnecting}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Key file fields (shown when auth=keyfile) */}
            {authMethod === "keyfile" && (
              <>
                <FormField
                  control={form.control}
                  name="keyPath"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Key File Path</FormLabel>
                      <div className="flex gap-2">
                        <FormControl>
                          <Input
                            placeholder="~/.ssh/id_rsa"
                            disabled={isConnecting}
                            {...field}
                          />
                        </FormControl>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          disabled={isConnecting}
                          onClick={handleBrowseKeyFile}
                          aria-label="Browse for key file"
                        >
                          <FolderOpen className="size-4" />
                        </Button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="passphrase"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Passphrase{" "}
                        <span className="text-muted-foreground font-normal">
                          (optional)
                        </span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="Key passphrase"
                          disabled={isConnecting}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            {/* Error display */}
            {error && (
              <div
                role="alert"
                className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {error}
              </div>
            )}

            {/* Footer actions */}
            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                disabled={isConnecting}
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isConnecting}>
                {isConnecting && <Spinner className="mr-1" />}
                {isConnecting ? "Connecting..." : "Connect"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export { ConnectionDialog };
export type { ConnectionDialogProps, ConnectionParams };
