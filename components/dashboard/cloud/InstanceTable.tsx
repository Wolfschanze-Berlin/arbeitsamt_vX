"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Play, Square, RotateCcw, Trash2 } from "lucide-react";
import { InstanceActionConfirm } from "./InstanceActionConfirm";
import type { CloudResource, InstanceAction } from "@/lib/cloud/types";

interface InstanceTableProps {
  instances: CloudResource[];
  onAction: (instanceId: string, action: InstanceAction) => Promise<void>;
  actionLoading: boolean;
}

const stateStyles: Record<string, string> = {
  running: "bg-green-500/15 text-green-700 dark:text-green-400",
  stopped: "bg-muted text-muted-foreground",
  pending: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
  "shutting-down": "bg-orange-500/15 text-orange-700 dark:text-orange-400",
  terminated: "bg-red-500/15 text-red-700 dark:text-red-400",
  stopping: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
};

export function InstanceTable({
  instances,
  onAction,
  actionLoading,
}: InstanceTableProps) {
  const [confirm, setConfirm] = useState<{
    action: InstanceAction;
    instanceId: string;
    instanceName: string;
  } | null>(null);

  function openConfirm(
    instanceId: string,
    instanceName: string,
    action: InstanceAction,
  ) {
    setConfirm({ action, instanceId, instanceName });
  }

  async function handleConfirm() {
    if (!confirm) return;
    await onAction(confirm.instanceId, confirm.action);
    setConfirm(null);
  }

  if (instances.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        No EC2 instances found in this region.
      </div>
    );
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Instance ID</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>State</TableHead>
              <TableHead>Public IP</TableHead>
              <TableHead className="w-[50px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {instances.map((inst) => (
              <TableRow key={inst.instanceId}>
                <TableCell className="font-medium">{inst.name}</TableCell>
                <TableCell>
                  <code className="text-xs">{inst.instanceId}</code>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {inst.instanceType}
                </TableCell>
                <TableCell>
                  <Badge
                    variant="secondary"
                    className={stateStyles[inst.state] ?? ""}
                  >
                    {inst.state}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm font-mono">
                  {inst.publicIp ?? "-"}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-8">
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() =>
                          openConfirm(inst.instanceId, inst.name, "start")
                        }
                        disabled={inst.state === "running"}
                      >
                        <Play className="size-4 mr-2" />
                        Start
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() =>
                          openConfirm(inst.instanceId, inst.name, "stop")
                        }
                        disabled={inst.state === "stopped"}
                      >
                        <Square className="size-4 mr-2" />
                        Stop
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() =>
                          openConfirm(inst.instanceId, inst.name, "reboot")
                        }
                        disabled={inst.state !== "running"}
                      >
                        <RotateCcw className="size-4 mr-2" />
                        Reboot
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() =>
                          openConfirm(inst.instanceId, inst.name, "terminate")
                        }
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="size-4 mr-2" />
                        Terminate
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {confirm && (
        <InstanceActionConfirm
          open
          onOpenChange={(v) => !v && setConfirm(null)}
          action={confirm.action}
          instanceId={confirm.instanceId}
          instanceName={confirm.instanceName}
          onConfirm={handleConfirm}
          loading={actionLoading}
        />
      )}
    </>
  );
}
