"use client";

import { useState, useCallback } from "react";
import { tauriInvoke } from "@/lib/tauri";
import type {
  CloudAccount,
  CloudResource,
  InstanceAction,
} from "@/lib/cloud/types";

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

export function useCloudAccounts() {
  const [accounts, setAccounts] = useState<CloudAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await tauriInvoke<CloudAccount[]>("cloud_list_accounts");
      setAccounts(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const addAccount = useCallback(
    async (profileName: string, displayName: string, region: string) => {
      const account = await tauriInvoke<CloudAccount>("cloud_add_account", {
        profileName,
        displayName,
        region,
      });
      setAccounts((prev) => [...prev, account]);
      return account;
    },
    [],
  );

  const addManualAccount = useCallback(
    async (
      accessKey: string,
      secretKey: string,
      displayName: string,
      region: string,
    ) => {
      const account = await tauriInvoke<CloudAccount>(
        "cloud_add_manual_account",
        { accessKey, secretKey, displayName, region },
      );
      setAccounts((prev) => [...prev, account]);
      return account;
    },
    [],
  );

  const removeAccount = useCallback(async (accountId: string) => {
    await tauriInvoke<void>("cloud_remove_account", { accountId });
    setAccounts((prev) => prev.filter((a) => a.id !== accountId));
  }, []);

  return {
    accounts,
    loading,
    error,
    refresh,
    addAccount,
    addManualAccount,
    removeAccount,
  };
}

// ---------------------------------------------------------------------------
// AWS Profiles
// ---------------------------------------------------------------------------

export function useCloudProfiles() {
  const [profiles, setProfiles] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      const result = await tauriInvoke<string[]>("cloud_list_aws_profiles");
      setProfiles(result);
    } catch {
      setProfiles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  return { profiles, loading, fetch };
}

// ---------------------------------------------------------------------------
// Instances
// ---------------------------------------------------------------------------

export function useCloudInstances(accountId: string | null) {
  const [instances, setInstances] = useState<CloudResource[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(
    async (secretKey?: string | null) => {
      if (!accountId) return;
      try {
        setLoading(true);
        setError(null);
        const result = await tauriInvoke<CloudResource[]>(
          "cloud_list_instances",
          { accountId, secretKey: secretKey ?? null },
        );
        setInstances(result);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    },
    [accountId],
  );

  return { instances, loading, error, refresh };
}

// ---------------------------------------------------------------------------
// Instance Action
// ---------------------------------------------------------------------------

export function useInstanceAction() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(
    async (
      accountId: string,
      instanceId: string,
      action: InstanceAction,
      secretKey?: string | null,
    ) => {
      try {
        setLoading(true);
        setError(null);
        await tauriInvoke<void>("cloud_instance_action", {
          accountId,
          instanceId,
          action,
          secretKey: secretKey ?? null,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return { execute, loading, error };
}
