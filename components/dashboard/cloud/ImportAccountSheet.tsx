"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Loader2 } from "lucide-react";
import { useCloudProfiles } from "@/hooks/useCloud";
import { useCloud } from "@/context/CloudContext";
import { AWS_REGIONS } from "@/lib/cloud/types";
import { storeSecretKey } from "@/lib/cloud/stronghold";

interface ImportAccountSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImportAccountSheet({
  open,
  onOpenChange,
}: ImportAccountSheetProps) {
  const { profiles, loading: loadingProfiles, fetch: fetchProfiles } =
    useCloudProfiles();
  const { addAccount, addManualAccount } = useCloud();

  // Shared state
  const [tab, setTab] = useState<string>("profile");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Profile tab state
  const [selectedProfile, setSelectedProfile] = useState("");
  const [profileDisplayName, setProfileDisplayName] = useState("");
  const [profileRegion, setProfileRegion] = useState("us-east-1");

  // Manual tab state
  const [accessKey, setAccessKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [manualDisplayName, setManualDisplayName] = useState("");
  const [manualRegion, setManualRegion] = useState("us-east-1");

  useEffect(() => {
    if (open) {
      fetchProfiles();
      setTab("profile");
      setSelectedProfile("");
      setProfileDisplayName("");
      setProfileRegion("us-east-1");
      setAccessKey("");
      setSecretKey("");
      setManualDisplayName("");
      setManualRegion("us-east-1");
      setError(null);
    }
  }, [open, fetchProfiles]);

  // Auto-fill display name from profile selection
  useEffect(() => {
    if (selectedProfile && !profileDisplayName) {
      setProfileDisplayName(selectedProfile);
    }
  }, [selectedProfile, profileDisplayName]);

  async function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProfile) return;

    try {
      setSubmitting(true);
      setError(null);
      await addAccount(
        selectedProfile,
        profileDisplayName || selectedProfile,
        profileRegion,
      );
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!accessKey || !secretKey) return;

    try {
      setSubmitting(true);
      setError(null);

      // 1. Validate via STS and create account (secret sent to Rust for validation only)
      const account = await addManualAccount(
        accessKey,
        secretKey,
        manualDisplayName || `AWS ${accessKey.slice(0, 8)}...`,
        manualRegion,
      );

      // 2. Store secret key encrypted in Stronghold (keyed by account ID)
      await storeSecretKey(account.id, secretKey);

      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  const regionSelector = (
    value: string,
    onChange: (v: string) => void,
  ) => (
    <div className="space-y-2">
      <Label>Default Region</Label>
      <Select value={value} onValueChange={onChange} disabled={submitting}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {AWS_REGIONS.map((r) => (
            <SelectItem key={r.value} value={r.value}>
              {r.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add AWS Account</DialogTitle>
          <DialogDescription>
            Import from an existing AWS CLI profile or enter credentials
            manually. Credentials are validated via STS before saving.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full">
            <TabsTrigger value="profile" className="flex-1">
              Import Profile
            </TabsTrigger>
            <TabsTrigger value="manual" className="flex-1">
              Manual
            </TabsTrigger>
          </TabsList>

          {/* ── Import Profile Tab ── */}
          <TabsContent value="profile">
            <form onSubmit={handleProfileSubmit} className="grid gap-4 pt-2">
              <div className="space-y-2">
                <Label>AWS Profile</Label>
                {loadingProfiles ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                    <Loader2 className="size-4 animate-spin" />
                    Loading profiles...
                  </div>
                ) : profiles.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">
                    No AWS profiles found. Check{" "}
                    <code className="text-xs bg-muted px-1 rounded">
                      ~/.aws/credentials
                    </code>{" "}
                    or use the Manual tab.
                  </p>
                ) : (
                  <Select
                    value={selectedProfile}
                    onValueChange={setSelectedProfile}
                    disabled={submitting}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a profile" />
                    </SelectTrigger>
                    <SelectContent>
                      {profiles.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="space-y-2">
                <Label>Display Name</Label>
                <Input
                  value={profileDisplayName}
                  onChange={(e) => setProfileDisplayName(e.target.value)}
                  placeholder="My AWS Account"
                  disabled={submitting}
                />
              </div>

              {regionSelector(profileRegion, setProfileRegion)}

              {error && tab === "profile" && (
                <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={submitting}
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting || !selectedProfile}>
                  {submitting && <Loader2 className="size-4 mr-1 animate-spin" />}
                  {submitting ? "Validating..." : "Import"}
                </Button>
              </div>
            </form>
          </TabsContent>

          {/* ── Manual Entry Tab ── */}
          <TabsContent value="manual">
            <form onSubmit={handleManualSubmit} className="grid gap-4 pt-2">
              <div className="space-y-2">
                <Label>Access Key ID</Label>
                <Input
                  value={accessKey}
                  onChange={(e) => setAccessKey(e.target.value)}
                  placeholder="AKIAIOSFODNN7EXAMPLE"
                  disabled={submitting}
                  autoComplete="off"
                  spellCheck={false}
                  className="font-mono text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label>Secret Access Key</Label>
                <Input
                  type="password"
                  value={secretKey}
                  onChange={(e) => setSecretKey(e.target.value)}
                  placeholder="Enter your secret access key"
                  disabled={submitting}
                  autoComplete="off"
                />
                <p className="text-xs text-muted-foreground">
                  Encrypted at rest using Stronghold vault.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Display Name</Label>
                <Input
                  value={manualDisplayName}
                  onChange={(e) => setManualDisplayName(e.target.value)}
                  placeholder="My AWS Account"
                  disabled={submitting}
                />
              </div>

              {regionSelector(manualRegion, setManualRegion)}

              {error && tab === "manual" && (
                <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={submitting}
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting || !accessKey || !secretKey}
                >
                  {submitting && <Loader2 className="size-4 mr-1 animate-spin" />}
                  {submitting ? "Validating..." : "Add Account"}
                </Button>
              </div>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
