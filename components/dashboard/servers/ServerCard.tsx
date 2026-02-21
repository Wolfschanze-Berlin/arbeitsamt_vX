"use client";

import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type ServerStatus = "checking" | "reachable" | "unreachable";

interface ServerCardProps {
  alias: string;
  hostname: string;
  port: number;
  username: string;
  status: ServerStatus;
  /** If set, this card represents a WSL distro on the parent host */
  wslDistro?: string;
  /** Parent host alias for WSL distros (used for SSH routing) */
  parentHost?: string;
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
  wslDistro,
  parentHost,
}: ServerCardProps) {
  const router = useRouter();

  const isLocalWsl = wslDistro && parentHost === "localhost";

  const handleClick = () => {
    if (isLocalWsl) {
      // Local WSL — open server detail with localhost marker
      router.push(
        `/servers/detail?host=localhost&wsl=${encodeURIComponent(wslDistro)}`,
      );
    } else if (wslDistro && parentHost) {
      // Remote WSL — route through parent SSH host
      router.push(
        `/servers/detail?host=${encodeURIComponent(parentHost)}&wsl=${encodeURIComponent(wslDistro)}`,
      );
    } else {
      router.push(`/servers/detail?host=${encodeURIComponent(alias)}`);
    }
  };

  return (
    <Card
      className="cursor-pointer transition-colors hover:bg-accent/50"
      onClick={handleClick}
    >
      <CardHeader className="flex-row items-center justify-between pb-0">
        <div className="flex items-center gap-2 truncate">
          <CardTitle className="truncate text-base">
            {wslDistro ?? alias}
          </CardTitle>
          {wslDistro && (
            <Badge variant="outline" className="shrink-0 text-[10px] px-1.5 py-0">
              WSL
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn("size-2.5 shrink-0 rounded-full", statusStyles[status])}
            aria-label={statusLabels[status]}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-1 pt-0">
        <p className="text-muted-foreground truncate text-sm">
          {wslDistro ? `via ${parentHost}` : `${hostname}:${port}`}
        </p>
        <p className="text-muted-foreground truncate text-sm">{username}</p>
      </CardContent>
    </Card>
  );
}
