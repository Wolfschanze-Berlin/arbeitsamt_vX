"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FolderOpen } from "lucide-react";

interface StepConfigureProps {
  projectName: string;
  onNameChange: (n: string) => void;
  clonePath: string;
  onClonePathChange: (p: string) => void;
}

export function StepConfigure({
  projectName,
  onNameChange,
  clonePath,
  onClonePathChange,
}: StepConfigureProps) {
  async function pickFolder() {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const dir = await open({ directory: true, multiple: false });
      if (typeof dir === "string" && dir) {
        // Append project name as subdirectory
        const sep = dir.includes("\\") ? "\\" : "/";
        onClonePathChange(`${dir}${sep}${projectName || "project"}`);
      }
    } catch {
      // Dialog cancelled or not available — no-op
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="project-name">Project name</Label>
        <Input
          id="project-name"
          placeholder="my-project"
          value={projectName}
          onChange={(e) => onNameChange(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="clone-path">Local clone path</Label>
        <div className="flex gap-2">
          <Input
            id="clone-path"
            placeholder="/home/user/projects/my-project"
            value={clonePath}
            onChange={(e) => onClonePathChange(e.target.value)}
            className="flex-1 font-mono text-sm"
          />
          <Button
            variant="outline"
            size="icon"
            onClick={pickFolder}
            title="Choose parent folder"
          >
            <FolderOpen className="size-4" />
          </Button>
        </div>
        <p className="text-muted-foreground text-xs">
          The repository will be cloned into this directory.
        </p>
      </div>
    </div>
  );
}
