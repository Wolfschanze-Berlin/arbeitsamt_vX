"use client";

import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type ServerStatus = "checking" | "reachable" | "unreachable";

interface ServerCardProps {
  alias: string;
  hostname: string;
  port: number;
  username: string;
  status: ServerStatus;
}

const statusStyles: Record<ServerStatus, string> = {
  checking: "bg-muted-foreground/50 animate-pulse",
  reachable: "bg-green-500",
  unreachable: "bg-red-500",
};

const statusLabels: Record<ServerStatus, string> = {
  checking: "Checking",
  reachable: "Reachable",
  unreachable: "Unreachable",
};

export function ServerCard({
  alias,
  hostname,
  port,
  username,
  status,
}: ServerCardProps) {
  const router = useRouter();

  return (
    <Card
      className="cursor-pointer transition-colors hover:bg-accent/50"
      onClick={() => router.push(`/servers/${alias}`)}
    >
      <CardHeader className="flex-row items-center justify-between pb-0">
        <CardTitle className="truncate text-base">{alias}</CardTitle>
        <div className="flex items-center gap-2">
          <span
            className={cn("size-2.5 shrink-0 rounded-full", statusStyles[status])}
            aria-label={statusLabels[status]}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-1 pt-0">
        <p className="text-muted-foreground truncate text-sm">
          {hostname}:{port}
        </p>
        <p className="text-muted-foreground truncate text-sm">{username}</p>
      </CardContent>
    </Card>
  );
}
