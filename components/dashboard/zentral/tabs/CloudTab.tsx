"use client";

import { useState } from "react";
import {
  Cloud,
  Box,
  Database,
  GitBranch,
  Activity,
  Globe,
  ChevronDownIcon,
  PlusIcon,
  ExternalLinkIcon,
  PencilIcon,
  TrashIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { useZentral } from "@/context/ZentralContext";
import { CLOUD_ENVIRONMENTS, type CloudConnectionType, type CloudEnvironment, type ZentralCloudConnection } from "@/lib/zentral/types";
import type { ZentralProjectEntry } from "@/lib/zentral/types";
import { CloudConnectionSheet } from "./CloudConnectionSheet";
import { cn } from "@/lib/utils";

// --- Icon map ---

const TYPE_ICONS: Record<CloudConnectionType, React.ElementType> = {
  aws: Cloud,
  gcp: Cloud,
  azure: Cloud,
  "docker-registry": Box,
  database: Database,
  "ci-cd": GitBranch,
  monitoring: Activity,
  generic: Globe,
};

// --- Environment badge colors ---

const ENV_BADGE_CLASS: Record<CloudEnvironment, string> = {
  production: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  staging: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  development: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  other: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

// --- Props ---

interface CloudTabProps {
  project: ZentralProjectEntry;
}

// --- Connection card ---

interface ConnectionCardProps {
  conn: ZentralCloudConnection;
  onEdit: () => void;
  onRemove: () => void;
}

function ConnectionCard({ conn, onEdit, onRemove }: ConnectionCardProps) {
  const Icon = TYPE_ICONS[conn.type];

  return (
    <div className="flex items-start gap-3 rounded-lg border bg-card px-4 py-3">
      <div className="bg-muted mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md">
        <Icon className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">{conn.label}</span>
          <Badge
            className={cn(
              "border-0 text-[10px] font-medium",
              ENV_BADGE_CLASS[conn.environment],
            )}
          >
            {conn.environment}
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            {conn.type}
          </Badge>
        </div>
        {conn.url && (
          <a
            href={conn.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground mt-0.5 flex items-center gap-1 truncate text-xs underline-offset-2 hover:underline"
          >
            <ExternalLinkIcon className="size-3 shrink-0" />
            {conn.url}
          </a>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {conn.url && (
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            asChild
          >
            <a href={conn.url} target="_blank" rel="noopener noreferrer">
              <ExternalLinkIcon className="size-3.5" />
            </a>
          </Button>
        )}
        <Button variant="ghost" size="icon" className="size-7" onClick={onEdit}>
          <PencilIcon className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="text-destructive hover:text-destructive size-7"
          onClick={onRemove}
        >
          <TrashIcon className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

// --- Environment group ---

interface EnvGroupProps {
  environment: CloudEnvironment;
  connections: ZentralCloudConnection[];
  onEdit: (conn: ZentralCloudConnection) => void;
  onRemove: (id: string) => void;
}

function EnvGroup({ environment, connections, onEdit, onRemove }: EnvGroupProps) {
  const [open, setOpen] = useState(true);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex w-full items-center gap-2 py-1 text-left">
        <ChevronDownIcon
          className={cn(
            "text-muted-foreground size-4 shrink-0 transition-transform",
            !open && "-rotate-90",
          )}
        />
        <span className="text-sm font-semibold capitalize">{environment}</span>
        <span className="text-muted-foreground text-xs">({connections.length})</span>
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col gap-2 pb-2 pt-1">
        {connections.map((conn) => (
          <ConnectionCard
            key={conn.id}
            conn={conn}
            onEdit={() => onEdit(conn)}
            onRemove={() => onRemove(conn.id)}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

// --- Main tab ---

export function CloudTab({ project }: CloudTabProps) {
  const { addOrUpdateProject } = useZentral();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<ZentralCloudConnection | null>(null);

  const connections: ZentralCloudConnection[] = project.config?.cloud ?? [];

  function openAdd() {
    setEditing(null);
    setSheetOpen(true);
  }

  function openEdit(conn: ZentralCloudConnection) {
    setEditing(conn);
    setSheetOpen(true);
  }

  async function handleSave(conn: ZentralCloudConnection) {
    const existing = connections.filter((c) => c.id !== conn.id);
    await addOrUpdateProject({
      ...project,
      config: {
        ...project.config!,
        cloud: [...existing, conn],
      },
    });
  }

  async function handleRemove(id: string) {
    await addOrUpdateProject({
      ...project,
      config: {
        ...project.config!,
        cloud: connections.filter((c) => c.id !== id),
      },
    });
  }

  const grouped = CLOUD_ENVIRONMENTS.map((env) => ({
    environment: env,
    connections: connections.filter((c) => c.environment === env),
  })).filter((g) => g.connections.length > 0);

  return (
    <div className="flex flex-col gap-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Cloud Connections</h2>
          <p className="text-muted-foreground text-xs">
            Bookmarks to cloud services — no credentials stored.
          </p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={openAdd}>
          <PlusIcon className="size-3.5" />
          Add Connection
        </Button>
      </div>

      {/* Empty state */}
      {connections.length === 0 && (
        <div className="text-muted-foreground flex flex-col items-center gap-2 rounded-lg border border-dashed py-12 text-center">
          <Cloud className="size-8 opacity-40" />
          <p className="text-sm">No cloud connections.</p>
          <p className="text-xs opacity-70">
            Add bookmarks to your cloud services.
          </p>
        </div>
      )}

      {/* Grouped connections */}
      {grouped.length > 0 && (
        <div className="flex flex-col gap-1">
          {grouped.map(({ environment, connections: conns }) => (
            <EnvGroup
              key={environment}
              environment={environment}
              connections={conns}
              onEdit={openEdit}
              onRemove={handleRemove}
            />
          ))}
        </div>
      )}

      {/* Add / Edit sheet */}
      <CloudConnectionSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        initial={editing}
        onSave={handleSave}
      />
    </div>
  );
}
