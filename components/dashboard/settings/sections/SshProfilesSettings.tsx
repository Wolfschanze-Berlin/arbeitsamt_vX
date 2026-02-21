"use client";

import { useState, useEffect, useCallback } from "react";
import { useSettings } from "@/context/settings-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type SshProfile,
  type ProfileAuthMethod,
  PROFILE_COLOR_TAGS,
} from "@/lib/settings";
import { tauriInvoke } from "@/lib/tauri";
import { Plus, MoreHorizontal, Pencil, Trash2, FolderOpen, Monitor } from "lucide-react";
import { useRouter } from "next/navigation";

interface SshConfigEntry {
  alias: string;
  hostname: string;
  port: number;
  user: string | null;
  identityFile: string | null;
}

function generateId() {
  return crypto.randomUUID();
}

const EMPTY_PROFILE: Omit<SshProfile, "id"> = {
  name: "",
  host: "",
  port: 22,
  username: "",
  authMethod: { method: "keyfile", keyPath: "" },
  colorTag: null,
};

export function SshProfilesSettings() {
  const { settings, addProfile, updateProfile, removeProfile } = useSettings();
  const router = useRouter();

  const [editDialog, setEditDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<string | null>(null);
  const [editingProfile, setEditingProfile] = useState<SshProfile | null>(null);
  const [configEntries, setConfigEntries] = useState<SshConfigEntry[]>([]);

  function handleNew() {
    setEditingProfile({ id: generateId(), ...EMPTY_PROFILE });
    setEditDialog(true);
  }

  function handleEdit(profile: SshProfile) {
    setEditingProfile({ ...profile });
    setEditDialog(true);
  }

  function handleSave() {
    if (!editingProfile) return;
    const exists = settings.sshProfiles.some((p) => p.id === editingProfile.id);
    if (exists) {
      updateProfile(editingProfile);
    } else {
      addProfile(editingProfile);
    }
    setEditDialog(false);
    setEditingProfile(null);
  }

  function handleDelete(id: string) {
    removeProfile(id);
    setDeleteDialog(null);
  }

  function handleConnect(profile: SshProfile) {
    // Navigate to SSH page — the profile info is accessed via SettingsContext
    router.push(`/ssh?profile=${profile.id}`);
  }

  async function handlePickKeyFile() {
    if (!editingProfile) return;
    try {
      const result = await tauriInvoke<string | null>("plugin:dialog|open", {
        title: "Select SSH Key File",
        defaultPath: "~/.ssh/",
      });
      if (result) {
        setEditingProfile({
          ...editingProfile,
          authMethod: { method: "keyfile", keyPath: result },
        });
      }
    } catch {
      // dialog not available in dev
    }
  }

  // Auto-fetch SSH config hosts on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const hosts = await tauriInvoke<string[]>("ssh_list_config_hosts");
        if (cancelled) return;
        const resolved = await Promise.all(
          hosts.map(async (alias) => {
            try {
              const cfg = await tauriInvoke<{
                hostname: string;
                port: number;
                user: string | null;
                identityFile: string | null;
              }>("ssh_resolve_config", { host: alias });
              return { alias, ...cfg };
            } catch {
              return { alias, hostname: alias, port: 22, user: null, identityFile: null };
            }
          }),
        );
        if (!cancelled) setConfigEntries(resolved);
      } catch {
        // Not in Tauri or no SSH config — silently ignore
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleImportEntry = useCallback(
    (entry: SshConfigEntry) => {
      const authMethod: ProfileAuthMethod = entry.identityFile
        ? { method: "keyfile", keyPath: entry.identityFile }
        : { method: "agent" };

      setEditingProfile({
        id: generateId(),
        name: entry.alias,
        host: entry.hostname,
        port: entry.port,
        username: entry.user ?? "",
        authMethod,
        colorTag: null,
      });
      setEditDialog(true);
    },
    [],
  );

  const profiles = settings.sshProfiles;

  // Filter config entries to only show hosts not already saved
  const availableConfigHosts = configEntries.filter(
    (entry) => !profiles.some((p) => p.host === entry.hostname && p.port === entry.port),
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Manage saved SSH connection profiles
        </p>
        <Button size="sm" onClick={handleNew}>
          <Plus className="mr-1 size-4" />
          New Profile
        </Button>
      </div>

      {/* Profile List */}
      {profiles.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No saved profiles yet. Click "New Profile" to create one.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {profiles.map((profile) => {
            const colorTag = PROFILE_COLOR_TAGS.find(
              (t) => t.value === profile.colorTag,
            );
            return (
              <Card key={profile.id}>
                <CardContent className="flex items-center gap-3 p-4">
                  {/* Color tag dot */}
                  <div
                    className={`size-3 rounded-full ${
                      colorTag?.className ?? "bg-muted-foreground"
                    }`}
                  />
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {profile.name || "Unnamed"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {profile.host}:{profile.port} &middot; {profile.username}
                    </p>
                  </div>
                  {/* Connect */}
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handleConnect(profile)}
                  >
                    Connect
                  </Button>
                  {/* Overflow menu */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-8">
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEdit(profile)}>
                        <Pencil className="mr-2 size-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => setDeleteDialog(profile.id)}
                      >
                        <Trash2 className="mr-2 size-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit / New Profile Dialog */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingProfile &&
              settings.sshProfiles.some((p) => p.id === editingProfile.id)
                ? "Edit Profile"
                : "New Profile"}
            </DialogTitle>
          </DialogHeader>
          {editingProfile && (
            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <Label>Profile Name</Label>
                <Input
                  placeholder="Production Server"
                  value={editingProfile.name}
                  onChange={(e) =>
                    setEditingProfile({ ...editingProfile, name: e.target.value })
                  }
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <Label>Host</Label>
                  <Input
                    placeholder="example.com"
                    value={editingProfile.host}
                    onChange={(e) =>
                      setEditingProfile({ ...editingProfile, host: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>Port</Label>
                  <Input
                    type="number"
                    value={editingProfile.port}
                    onChange={(e) =>
                      setEditingProfile({
                        ...editingProfile,
                        port: parseInt(e.target.value, 10) || 22,
                      })
                    }
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Username</Label>
                <Input
                  placeholder="deploy"
                  value={editingProfile.username}
                  onChange={(e) =>
                    setEditingProfile({
                      ...editingProfile,
                      username: e.target.value,
                    })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>Auth Method</Label>
                <Select
                  value={editingProfile.authMethod.method}
                  onValueChange={(v) => {
                    const method = v as ProfileAuthMethod["method"];
                    const authMethod: ProfileAuthMethod =
                      method === "keyfile"
                        ? { method: "keyfile", keyPath: "" }
                        : method === "agent"
                          ? { method: "agent" }
                          : { method: "password" };
                    setEditingProfile({ ...editingProfile, authMethod });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="keyfile">Key File</SelectItem>
                    <SelectItem value="agent">SSH Agent</SelectItem>
                    <SelectItem value="password">Password</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {editingProfile.authMethod.method === "keyfile" && (
                <div className="grid gap-2">
                  <Label>Key File Path</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="~/.ssh/id_ed25519"
                      value={editingProfile.authMethod.keyPath}
                      onChange={(e) =>
                        setEditingProfile({
                          ...editingProfile,
                          authMethod: {
                            method: "keyfile",
                            keyPath: e.target.value,
                          },
                        })
                      }
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handlePickKeyFile}
                      title="Browse..."
                    >
                      <FolderOpen className="size-4" />
                    </Button>
                  </div>
                </div>
              )}
              <div className="grid gap-2">
                <Label>Color Tag</Label>
                <div className="flex gap-2">
                  {PROFILE_COLOR_TAGS.map((tag) => (
                    <button
                      key={tag.value}
                      type="button"
                      className={`size-6 rounded-full ${tag.className} ring-offset-2 transition-all ${
                        editingProfile.colorTag === tag.value
                          ? "ring-2 ring-primary"
                          : "hover:ring-2 hover:ring-muted-foreground"
                      }`}
                      onClick={() =>
                        setEditingProfile({
                          ...editingProfile,
                          colorTag:
                            editingProfile.colorTag === tag.value
                              ? null
                              : tag.value,
                        })
                      }
                      title={tag.name}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={
                !editingProfile?.name || !editingProfile?.host || !editingProfile?.username
              }
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteDialog}
        onOpenChange={() => setDeleteDialog(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Profile</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this SSH profile? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteDialog && handleDelete(deleteDialog)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Auto-discovered SSH Config Hosts */}
      {availableConfigHosts.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-2">
            <Monitor className="size-4 text-muted-foreground" />
            <p className="text-sm font-medium">From ~/.ssh/config</p>
          </div>
          <div className="grid gap-2">
            {availableConfigHosts.map((entry) => (
              <button
                key={entry.alias}
                type="button"
                onClick={() => handleImportEntry(entry)}
                className="flex items-center gap-3 rounded-lg border border-dashed p-3 text-left transition-colors hover:bg-accent hover:border-solid"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {entry.alias}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {entry.user ? `${entry.user}@` : ""}
                    {entry.hostname}:{entry.port}
                  </p>
                </div>
                <Plus className="size-4 text-muted-foreground" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
