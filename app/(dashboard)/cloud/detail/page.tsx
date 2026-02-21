"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ArrowLeft, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { InstanceTable } from "@/components/dashboard/cloud/InstanceTable";
import { useCloudInstances, useInstanceAction } from "@/hooks/useCloud";
import { getSecretKey } from "@/lib/cloud/stronghold";
import { tauriInvoke } from "@/lib/tauri";
import type { CloudAccount, InstanceAction } from "@/lib/cloud/types";

export default function CloudDetailPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const accountId = searchParams.get("id");

  const [account, setAccount] = useState<CloudAccount | null>(null);
  const [loadingAccount, setLoadingAccount] = useState(true);
  const secretKeyRef = useRef<string | null>(null);

  const {
    instances,
    loading: loadingInstances,
    error: instanceError,
    refresh: refreshInstances,
  } = useCloudInstances(accountId);

  const { execute: executeAction, loading: actionLoading } =
    useInstanceAction();

  // Load account metadata
  useEffect(() => {
    if (!accountId) return;
    let cancelled = false;

    async function load() {
      try {
        setLoadingAccount(true);
        const accounts = await tauriInvoke<CloudAccount[]>(
          "cloud_list_accounts",
        );
        const found = accounts.find((a) => a.id === accountId);
        if (!cancelled) {
          setAccount(found ?? null);
          // Pre-load secret key for manual accounts
          if (found?.authMode === "manual") {
            secretKeyRef.current = await getSecretKey(found.id);
          }
        }
      } catch {
        // Silently handle — account not found will show error
      } finally {
        if (!cancelled) setLoadingAccount(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [accountId]);

  // Auto-load instances when account is available
  useEffect(() => {
    if (accountId && account) {
      refreshInstances(secretKeyRef.current);
    }
  }, [accountId, account, refreshInstances]);

  const handleRefresh = useCallback(() => {
    refreshInstances(secretKeyRef.current);
  }, [refreshInstances]);

  const handleAction = useCallback(
    async (instanceId: string, action: InstanceAction) => {
      if (!accountId) return;
      await executeAction(accountId, instanceId, action, secretKeyRef.current);
      // Refresh list after a short delay for state propagation
      setTimeout(() => refreshInstances(secretKeyRef.current), 1500);
    },
    [accountId, executeAction, refreshInstances],
  );

  if (!accountId) {
    return (
      <div className="p-6 text-muted-foreground">
        No account ID specified.
      </div>
    );
  }

  if (loadingAccount) {
    return (
      <div className="flex items-center justify-center p-6 py-20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!account) {
    return (
      <div className="p-6">
        <Button variant="ghost" size="sm" onClick={() => router.push("/cloud")}>
          <ArrowLeft className="size-4 mr-1" />
          Back
        </Button>
        <p className="text-muted-foreground mt-4">Account not found.</p>
      </div>
    );
  }

  // Build subtitle based on auth mode
  const subtitle =
    account.authMode === "manual"
      ? `${account.accessKeyId?.slice(0, 8)}... · ${account.region}`
      : `${account.profileName} · ${account.region}`;

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push("/cloud")}>
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold truncate">
              {account.displayName}
            </h1>
            <Badge variant="outline" className="shrink-0">
              AWS
            </Badge>
            {account.authMode === "manual" && (
              <Badge variant="secondary" className="shrink-0 text-[10px]">
                Manual
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground text-sm">
            {subtitle} &middot;{" "}
            <span className="font-mono text-xs">{account.accountId}</span>
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={loadingInstances}
        >
          <RefreshCw
            className={`size-4 mr-1 ${loadingInstances ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      {/* Error banner */}
      {instanceError && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          {instanceError}
        </div>
      )}

      {/* Instance table */}
      {loadingInstances && instances.length === 0 ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <InstanceTable
          instances={instances}
          onAction={handleAction}
          actionLoading={actionLoading}
        />
      )}
    </div>
  );
}
