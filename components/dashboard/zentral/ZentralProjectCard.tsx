"use client";

import { MoreHorizontal, Server, Cloud, FolderGit2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ZentralProjectEntry } from "@/lib/zentral/types";

interface ZentralProjectCardProps {
  entry: ZentralProjectEntry;
  onOpen: (entry: ZentralProjectEntry) => void;
  onEdit: (entry: ZentralProjectEntry) => void;
  onRemove: (entry: ZentralProjectEntry) => void;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function ZentralProjectCard({
  entry,
  onOpen,
  onEdit,
  onRemove,
}: ZentralProjectCardProps) {
  const subtitle = entry.repoFullName ?? entry.localPath ?? "—";
  const serverCount = entry.config?.servers.length ?? 0;
  const cloudCount = entry.config?.cloud.length ?? 0;

  return (
    <Card className="flex flex-col gap-0">
      <CardHeader className="flex-row items-start justify-between pb-2">
        <div className="min-w-0">
          <CardTitle className="truncate text-base">{entry.name}</CardTitle>
          <p className="text-muted-foreground mt-0.5 flex items-center gap-1 truncate text-sm">
            <FolderGit2 className="size-3.5 shrink-0" />
            <span className="truncate">{subtitle}</span>
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-7 shrink-0">
              <MoreHorizontal className="size-4" />
              <span className="sr-only">More options</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(entry)}>Edit</DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onRemove(entry)}
              className="text-destructive focus:text-destructive"
            >
              Remove
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>

      <CardContent className="flex flex-col gap-3 pt-0">
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="secondary" className="gap-1">
            <Server className="size-3" />
            {serverCount} {serverCount === 1 ? "server" : "servers"}
          </Badge>
          <Badge variant="secondary" className="gap-1">
            <Cloud className="size-3" />
            {cloudCount} {cloudCount === 1 ? "connection" : "connections"}
          </Badge>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-xs">
            {formatDate(entry.importedAt)}
          </span>
          <Button size="sm" onClick={() => onOpen(entry)}>
            Open
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
