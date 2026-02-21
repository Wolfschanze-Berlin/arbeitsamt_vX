"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Plus,
  Globe,
  Server,
  FolderX,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  XCircle,
  FolderOpen,
  Code2,
} from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { ZentralProvider, useZentral } from "@/context/ZentralContext";
import { ZentralProjectCard } from "@/components/dashboard/zentral/ZentralProjectCard";
import { DiscoveryFlow } from "@/components/dashboard/zentral/DiscoveryFlow";
import { CreateProjectDrawer } from "@/components/dashboard/zentral/CreateProjectDrawer";
import { AddRemoteDialog } from "@/components/dashboard/zentral/AddRemoteDialog";
import { AddFromServerDialog } from "@/components/dashboard/zentral/AddFromServerDialog";
import { OverviewTab } from "@/components/dashboard/zentral/tabs/OverviewTab";
import { ServersTab } from "@/components/dashboard/zentral/tabs/ServersTab";
import { CloudTab } from "@/components/dashboard/zentral/tabs/CloudTab";
import { NotesTab } from "@/components/dashboard/zentral/tabs/NotesTab";
import { FilesTab } from "@/components/dashboard/zentral/tabs/FilesTab";
import { SettingsTab } from "@/components/dashboard/zentral/tabs/SettingsTab";
import type { ZentralProjectEntry } from "@/lib/zentral/types";

// ─── Tab definitions ─────────────────────────────────────────────────────────

const TABS = [
  { slug: "overview", label: "Overview" },
  { slug: "servers", label: "Servers" },
  { slug: "cloud", label: "Cloud" },
  { slug: "files", label: "Files" },
  { slug: "notes", label: "Notes" },
  { slug: "settings", label: "Settings" },
] as const;

type TabSlug = (typeof TABS)[number]["slug"];

// ─── Project Detail View ─────────────────────────────────────────────────────

function ProjectDetailView({
  projectId,
  activeTab,
}: {
  projectId: string;
  activeTab: TabSlug;
}) {
  const router = useRouter();
  const { getProject, loading } = useZentral();
  const project = getProject(projectId);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <Loader2 className="text-muted-foreground size-8 animate-spin" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-8">
        <p className="text-muted-foreground">Project not found.</p>
        <Button variant="outline" onClick={() => router.push("/zentral")}>
          Back to Die Zentral
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b px-6 py-4">
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={() => router.push("/zentral")}
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-xl font-bold">{project.name}</h1>
            {project.localPath ? (
              <Badge variant="secondary" className="gap-1 shrink-0 text-xs">
                <CheckCircle2 className="size-3 text-green-500" />
                Cloned
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1 shrink-0 text-xs">
                <XCircle className="text-muted-foreground size-3" />
                Not cloned
              </Badge>
            )}
          </div>
          {project.repoFullName && (
            <p className="text-muted-foreground truncate text-sm">
              {project.repoFullName}
            </p>
          )}
          {project.localPath && (
            <p className="text-muted-foreground mt-0.5 flex items-center gap-1 truncate font-mono text-xs">
              <FolderOpen className="size-3 shrink-0" />
              {project.localPath}
            </p>
          )}
        </div>
        {project.localPath && (
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 gap-1.5"
            onClick={async () => {
              try {
                const { Command } = await import("@tauri-apps/plugin-shell");
                await Command.create("code-insiders", [
                  "--new-window",
                  project.localPath!,
                ]).execute();
              } catch (e) {
                console.error("Failed to open in VS Code Insiders:", e);
              }
            }}
          >
            <Code2 className="size-4" />
            Open in VS Code Insiders
          </Button>
        )}
      </div>

      {/* Tab nav */}
      <div className="border-b px-6">
        <nav className="flex gap-1 pt-2">
          {TABS.map(({ slug, label }) => (
            <Link
              key={slug}
              href={`/zentral?id=${projectId}&tab=${slug}`}
              className={cn(
                "rounded-t px-3 py-1.5 text-sm font-medium transition-colors",
                activeTab === slug
                  ? "border-b-2 border-primary text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-6">
        <TabContent project={project} tab={activeTab} />
      </div>
    </div>
  );
}

function TabContent({
  project,
  tab,
}: {
  project: ZentralProjectEntry;
  tab: TabSlug;
}) {
  switch (tab) {
    case "overview":
      return <OverviewTab project={project} />;
    case "servers":
      return <ServersTab project={project} />;
    case "cloud":
      return <CloudTab project={project} />;
    case "files":
      return <FilesTab project={project} />;
    case "notes":
      return <NotesTab project={project} />;
    case "settings":
      return <SettingsTab project={project} />;
  }
}

// ─── Project List View ───────────────────────────────────────────────────────

function ProjectListView() {
  const router = useRouter();
  const { projects, loading, deleteProject } = useZentral();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [remoteOpen, setRemoteOpen] = useState(false);
  const [serverOpen, setServerOpen] = useState(false);

  const handleOpen = (entry: ZentralProjectEntry) => {
    router.push(`/zentral?id=${entry.id}&tab=overview`);
  };

  const handleRemove = (entry: ZentralProjectEntry) => {
    deleteProject(entry.id);
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Die Zentral</h1>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setServerOpen(true)}>
            <Server className="size-4" />
            Add from Server
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setRemoteOpen(true)}>
            <Globe className="size-4" />
            Track Remote
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => setDrawerOpen(true)}>
            <Plus className="size-4" />
            Add Project
          </Button>
        </div>
      </div>

      {loading && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-lg" />
          ))}
        </div>
      )}

      {!loading && projects.length === 0 && (
        <div className="flex flex-col items-center gap-6 py-8">
          <div className="flex flex-col items-center gap-2 text-center">
            <FolderX className="text-muted-foreground size-10" />
            <p className="text-muted-foreground text-sm">
              No projects yet — let&apos;s find your repos.
            </p>
          </div>
          <DiscoveryFlow />
        </div>
      )}

      {!loading && projects.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((entry) => (
            <ZentralProjectCard
              key={entry.id}
              entry={entry}
              onOpen={handleOpen}
              onEdit={() => {}}
              onRemove={handleRemove}
            />
          ))}
        </div>
      )}

      <CreateProjectDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />
      <AddRemoteDialog open={remoteOpen} onOpenChange={setRemoteOpen} />
      <AddFromServerDialog open={serverOpen} onOpenChange={setServerOpen} />
    </div>
  );
}

// ─── Page (routing via query params) ─────────────────────────────────────────

function ZentralPageContent() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("id");
  const tab = (searchParams.get("tab") ?? "overview") as TabSlug;

  if (projectId) {
    return <ProjectDetailView projectId={projectId} activeTab={tab} />;
  }

  return <ProjectListView />;
}

export default function ZentralPage() {
  return (
    <ZentralProvider>
      <ZentralPageContent />
    </ZentralProvider>
  );
}
