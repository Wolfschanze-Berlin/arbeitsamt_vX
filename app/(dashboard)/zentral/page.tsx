"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, FolderX, ArrowLeft, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ZentralProvider, useZentral } from "@/context/ZentralContext";
import { ZentralProjectCard } from "@/components/dashboard/zentral/ZentralProjectCard";
import { DiscoveryFlow } from "@/components/dashboard/zentral/DiscoveryFlow";
import { CreateProjectDrawer } from "@/components/dashboard/zentral/CreateProjectDrawer";
import { OverviewTab } from "@/components/dashboard/zentral/tabs/OverviewTab";
import { ServersTab } from "@/components/dashboard/zentral/tabs/ServersTab";
import { CloudTab } from "@/components/dashboard/zentral/tabs/CloudTab";
import { NotesTab } from "@/components/dashboard/zentral/tabs/NotesTab";
import type { ZentralProjectEntry } from "@/lib/zentral/types";

// ─── Project Detail View ─────────────────────────────────────────────────────

function ProjectDetailView({ projectId }: { projectId: string }) {
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
      <div className="flex items-center gap-3 border-b px-6 py-4">
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={() => router.push("/zentral")}
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold">{project.name}</h1>
          {project.repoFullName && (
            <p className="text-muted-foreground truncate text-sm">
              {project.repoFullName}
            </p>
          )}
        </div>
      </div>

      <Tabs defaultValue="overview" className="flex flex-1 flex-col overflow-hidden">
        <TabsList className="mx-6 mt-4 w-fit">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="servers">Servers</TabsTrigger>
          <TabsTrigger value="cloud">Cloud</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>
        <div className="flex-1 overflow-y-auto">
          <TabsContent value="overview" className="mt-0 p-6">
            <OverviewTab project={project} />
          </TabsContent>
          <TabsContent value="servers" className="mt-0 p-6">
            <ServersTab project={project} />
          </TabsContent>
          <TabsContent value="cloud" className="mt-0 p-6">
            <CloudTab project={project} />
          </TabsContent>
          <TabsContent value="notes" className="mt-0 p-6">
            <NotesTab project={project} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

// ─── Project List View ───────────────────────────────────────────────────────

function ProjectListView() {
  const router = useRouter();
  const { projects, loading, deleteProject } = useZentral();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleOpen = (entry: ZentralProjectEntry) => {
    router.push(`/zentral?project=${entry.id}`);
  };

  const handleRemove = (entry: ZentralProjectEntry) => {
    deleteProject(entry.id);
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Die Zentral</h1>
        <Button size="sm" className="gap-1.5" onClick={() => setDrawerOpen(true)}>
          <Plus className="size-4" />
          Add Project
        </Button>
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
            <p className="text-muted-foreground text-sm">No projects yet — let&apos;s find your repos.</p>
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
    </div>
  );
}

// ─── Page (routing via query param) ──────────────────────────────────────────

function ZentralPageContent() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("project");

  if (projectId) {
    return <ProjectDetailView projectId={projectId} />;
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
