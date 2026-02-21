"use client";

import { useCallback, useState } from "react";
import { CloudProvider, useCloud } from "@/context/CloudContext";
import { AccountCard } from "@/components/dashboard/cloud/AccountCard";
import { ImportAccountSheet } from "@/components/dashboard/cloud/ImportAccountSheet";
import { removeSecretKey } from "@/lib/cloud/stronghold";
import { Button } from "@/components/ui/button";
import { Cloud, Plus, RefreshCw, Loader2 } from "lucide-react";

function CloudContent() {
  const { accounts, loading, error, refresh, removeAccount } = useCloud();
  const [showImport, setShowImport] = useState(false);

  // Wrap removeAccount to also clean up Stronghold secrets for manual accounts
  const handleRemove = useCallback(
    async (accountId: string) => {
      const account = accounts.find((a) => a.id === accountId);
      await removeAccount(accountId);
      if (account?.authMode === "manual") {
        await removeSecretKey(accountId);
      }
    },
    [accounts, removeAccount],
  );

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Cloud</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
            <RefreshCw className={`size-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setShowImport(true)}>
            <Plus className="size-4 mr-1" />
            Add Account
          </Button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading && accounts.length === 0 && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Empty state */}
      {!loading && accounts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="rounded-full bg-muted p-4 mb-4">
            <Cloud className="size-8 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-semibold">No cloud accounts</h2>
          <p className="text-muted-foreground text-sm mt-1 max-w-sm">
            Import an AWS profile from your local credentials to get started
            managing EC2 instances.
          </p>
          <Button className="mt-4" onClick={() => setShowImport(true)}>
            <Plus className="size-4 mr-1" />
            Add Account
          </Button>
        </div>
      )}

      {/* Account grid */}
      {accounts.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {accounts.map((account) => (
            <AccountCard
              key={account.id}
              account={account}
              onRemove={handleRemove}
            />
          ))}
        </div>
      )}

      <ImportAccountSheet open={showImport} onOpenChange={setShowImport} />
    </div>
  );
}

export default function CloudPage() {
  return (
    <CloudProvider>
      <CloudContent />
    </CloudProvider>
  );
}
