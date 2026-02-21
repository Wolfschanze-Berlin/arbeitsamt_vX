"use client";

import {
  createContext,
  useContext,
  useEffect,
  type ReactNode,
} from "react";

import { useCloudAccounts } from "@/hooks/useCloud";
import type { CloudAccount } from "@/lib/cloud/types";

// --- Types ---

interface CloudContextValue {
  accounts: CloudAccount[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  addAccount: (
    profileName: string,
    displayName: string,
    region: string,
  ) => Promise<CloudAccount>;
  addManualAccount: (
    accessKey: string,
    secretKey: string,
    displayName: string,
    region: string,
  ) => Promise<CloudAccount>;
  removeAccount: (accountId: string) => Promise<void>;
}

// --- Context ---

const CloudContext = createContext<CloudContextValue | null>(null);

// --- Provider ---

export function CloudProvider({ children }: { children: ReactNode }) {
  const ctx = useCloudAccounts();

  useEffect(() => {
    ctx.refresh();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <CloudContext.Provider value={ctx}>
      {children}
    </CloudContext.Provider>
  );
}

// --- Hook ---

export function useCloud(): CloudContextValue {
  const ctx = useContext(CloudContext);
  if (!ctx) throw new Error("useCloud must be used within CloudProvider");
  return ctx;
}
