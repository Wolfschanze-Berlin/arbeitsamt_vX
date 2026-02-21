"use client";

import { useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { InstanceAction } from "@/lib/cloud/types";

interface InstanceActionConfirmProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: InstanceAction;
  instanceId: string;
  instanceName: string;
  onConfirm: () => void;
  loading?: boolean;
}

const actionLabels: Record<InstanceAction, string> = {
  start: "Start",
  stop: "Stop",
  reboot: "Reboot",
  terminate: "Terminate",
};

const actionDescriptions: Record<InstanceAction, string> = {
  start: "This will start the instance. It may take a few minutes to become available.",
  stop: "This will stop the instance. You can restart it later.",
  reboot: "This will reboot the instance. Running processes may be interrupted.",
  terminate:
    "This will permanently destroy the instance and all associated data. This action cannot be undone.",
};

export function InstanceActionConfirm({
  open,
  onOpenChange,
  action,
  instanceId,
  instanceName,
  onConfirm,
  loading = false,
}: InstanceActionConfirmProps) {
  const [confirmText, setConfirmText] = useState("");
  const isTerminate = action === "terminate";
  const canConfirm = isTerminate ? confirmText === instanceId : true;

  return (
    <AlertDialog open={open} onOpenChange={(v) => {
      if (!v) setConfirmText("");
      onOpenChange(v);
    }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {actionLabels[action]} Instance
          </AlertDialogTitle>
          <AlertDialogDescription>
            {actionDescriptions[action]}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="text-sm space-y-1">
          <p>
            <span className="text-muted-foreground">Instance:</span>{" "}
            <span className="font-medium">{instanceName}</span>
          </p>
          <p>
            <span className="text-muted-foreground">ID:</span>{" "}
            <code className="text-xs bg-muted px-1 rounded">{instanceId}</code>
          </p>
        </div>

        {/* Type-to-confirm for terminate */}
        {isTerminate && (
          <div className="space-y-2 pt-2">
            <Label className="text-sm">
              Type <code className="text-xs bg-muted px-1 rounded">{instanceId}</code> to confirm
            </Label>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={instanceId}
              disabled={loading}
              autoComplete="off"
            />
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={!canConfirm || loading}
            className={isTerminate ? "bg-destructive hover:bg-destructive/90" : ""}
          >
            {loading ? "Processing..." : actionLabels[action]}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
