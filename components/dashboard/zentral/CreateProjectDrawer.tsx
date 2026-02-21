"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useZentral } from "@/context/ZentralContext";
import { tauriInvoke } from "@/lib/tauri";
import { createRepo, type GithubRepo } from "@/lib/github";
import type { ZentralProjectEntry } from "@/lib/zentral/types";
import { StepSelectRepo, type RepoMode, type NewRepoForm } from "./steps/StepSelectRepo";
import { StepConfigure } from "./steps/StepConfigure";
import { StepServers, type SshHost } from "./steps/StepServers";
import { StepConfirm, type CloneStatus } from "./steps/StepConfirm";

const STEPS = ["Select Repo", "Configure", "Add Servers", "Confirm"] as const;
type Step = 0 | 1 | 2 | 3;

interface CreateProjectDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateProjectDrawer({
  open,
  onOpenChange,
}: CreateProjectDrawerProps) {
  const router = useRouter();
  const { addOrUpdateProject } = useZentral();

  // Step navigation
  const [step, setStep] = useState<Step>(0);

  // Step 1 state
  const [mode, setMode] = useState<RepoMode>("link");
  const [selectedRepo, setSelectedRepo] = useState<GithubRepo | null>(null);
  const [newRepo, setNewRepo] = useState<NewRepoForm>({
    name: "",
    visibility: "private",
  });

  // Step 2 state
  const [projectName, setProjectName] = useState("");
  const [clonePath, setClonePath] = useState("");

  // Step 3 state
  const [selectedServers, setSelectedServers] = useState<string[]>([]);
  const [allHosts, setAllHosts] = useState<SshHost[]>([]);

  // Step 4 state
  const [cloneStatus, setCloneStatus] = useState<CloneStatus>("idle");
  const [logLines, setLogLines] = useState<string[]>([]);

  // Sync project name when repo is selected in Step 1
  function handleRepoSelect(r: GithubRepo) {
    setSelectedRepo(r);
    if (!projectName) setProjectName(r.name);
  }

  // Validate step before advancing
  function canAdvance(): boolean {
    if (step === 0) {
      return mode === "link" ? selectedRepo !== null : newRepo.name.trim() !== "";
    }
    if (step === 1) {
      return projectName.trim() !== "" && clonePath.trim() !== "";
    }
    return true;
  }

  async function handleNext() {
    if (step < 3) {
      setStep((s) => (s + 1) as Step);
      return;
    }
    // Step 4: Execute
    await runClone();
  }

  async function runClone() {
    setCloneStatus("running");
    setLogLines([]);

    try {
      let repoUrl: string;
      let repoFullName: string | null = null;

      if (mode === "link" && selectedRepo) {
        repoUrl = selectedRepo.html_url;
        repoFullName = selectedRepo.full_name;
      } else {
        // Create repo via GitHub API first
        const created = await createRepo(
          newRepo.name,
          newRepo.visibility === "private",
        );
        repoUrl = created.html_url;
        repoFullName = created.full_name;
      }

      // Start clone — streams progress via tauri events (listened in StepConfirm)
      await tauriInvoke("zentral_clone_project", {
        repoUrl,
        localPath: clonePath,
      });

      // Build ZentralServer entries
      const servers = selectedServers.map((alias) => ({
        sshAlias: alias,
        label: allHosts.find((h) => h.alias === alias)?.hostname,
      }));

      const entry: ZentralProjectEntry = {
        id: crypto.randomUUID(),
        canonicalId: repoFullName ?? projectName,
        name: projectName,
        localPath: clonePath,
        remoteUrl: repoUrl,
        repoFullName,
        config: {
          version: "1",
          name: projectName,
          servers,
          cloud: [],
        },
        importedAt: new Date().toISOString(),
      };

      await addOrUpdateProject(entry);
      setCloneStatus("done");

      // Close and navigate after a short pause
      setTimeout(() => {
        handleClose();
        router.push(`/zentral?project=${entry.id}`);
      }, 1200);
    } catch (e) {
      setCloneStatus("error");
      const msg = e instanceof Error ? e.message : String(e);
      setLogLines((prev) => [...prev, `Error: ${msg}`]);
    }
  }

  function handleClose() {
    onOpenChange(false);
    // Reset after animation
    setTimeout(resetState, 300);
  }

  function resetState() {
    setStep(0);
    setMode("link");
    setSelectedRepo(null);
    setNewRepo({ name: "", visibility: "private" });
    setProjectName("");
    setClonePath("");
    setSelectedServers([]);
    setAllHosts([]);
    setCloneStatus("idle");
    setLogLines([]);
  }

  const addLogLine = useCallback((line: string) => {
    setLogLines((prev) => [...prev, line]);
  }, []);

  const isExecuting = cloneStatus === "running";
  const isDone = cloneStatus === "done";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col">
        <SheetHeader className="pb-0">
          <SheetTitle>Add Project</SheetTitle>
          {/* Step indicator */}
          <div className="flex items-center gap-1 pt-1">
            {STEPS.map((label, i) => (
              <div key={label} className="flex items-center gap-1">
                <span
                  className={
                    i === step
                      ? "text-foreground text-xs font-semibold"
                      : i < step
                        ? "text-muted-foreground text-xs"
                        : "text-muted-foreground/40 text-xs"
                  }
                >
                  {i + 1}. {label}
                </span>
                {i < STEPS.length - 1 && (
                  <span className="text-muted-foreground/30 text-xs">›</span>
                )}
              </div>
            ))}
          </div>
        </SheetHeader>

        {/* Step content */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {step === 0 && (
            <StepSelectRepo
              mode={mode}
              onModeChange={setMode}
              selectedRepo={selectedRepo}
              onRepoSelect={handleRepoSelect}
              newRepo={newRepo}
              onNewRepoChange={setNewRepo}
            />
          )}
          {step === 1 && (
            <StepConfigure
              projectName={projectName}
              onNameChange={setProjectName}
              clonePath={clonePath}
              onClonePathChange={setClonePath}
            />
          )}
          {step === 2 && (
            <StepServers
              selected={selectedServers}
              onSelectionChange={setSelectedServers}
              onHostsLoaded={setAllHosts}
            />
          )}
          {step === 3 && (
            <StepConfirm
              mode={mode}
              selectedRepo={selectedRepo}
              newRepo={newRepo}
              projectName={projectName}
              clonePath={clonePath}
              selectedServers={selectedServers}
              allHosts={allHosts}
              status={cloneStatus}
              onStatusChange={setCloneStatus}
              logLines={logLines}
              onLogLine={addLogLine}
            />
          )}
        </div>

        <SheetFooter className="flex-row gap-2 border-t pt-4">
          {step > 0 && !isExecuting && !isDone && (
            <Button
              variant="outline"
              onClick={() => setStep((s) => (s - 1) as Step)}
            >
              Back
            </Button>
          )}
          {step === 2 && !isExecuting && (
            <Button
              variant="ghost"
              onClick={() => setStep(3)}
              className="mr-auto"
            >
              Skip
            </Button>
          )}
          <Button
            className="ml-auto"
            onClick={handleNext}
            disabled={!canAdvance() || isExecuting || isDone}
          >
            {step === 3 ? "Create Project" : "Next"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
