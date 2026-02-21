"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useSelectedRepo } from "@/context/selected-repo-context";
import { RepoDetailHeader } from "@/components/dashboard/github/repo-detail-header";
import { RepoDetailReadme } from "@/components/dashboard/github/repo-detail-readme";
import { RepoDetailReleases } from "@/components/dashboard/github/repo-detail-releases";
import { RepoFileTree } from "@/components/dashboard/github/repo-file-tree";
import { Button } from "@/components/ui/button";

export default function StarredDetailPage() {
  const { selectedRepo } = useSelectedRepo();

  if (!selectedRepo) {
    return (
      <div className="mx-auto max-w-screen-2xl p-4 md:p-6">
        <div className="flex flex-col items-center justify-center rounded-2xl border bg-card p-12 text-center">
          <p className="text-sm text-muted-foreground">
            No repository selected.
          </p>
          <Link
            href="/github/starred"
            className="mt-3 text-sm font-medium text-foreground underline-offset-4 hover:underline"
          >
            Back to starred repositories
          </Link>
        </div>
      </div>
    );
  }

  const [owner, repoName] = selectedRepo.full_name.split("/");

  return (
    <div className="mx-auto max-w-screen-2xl p-4 md:p-6 space-y-4 md:space-y-6">
      <Button variant="ghost" size="sm" asChild className="gap-1.5">
        <Link href="/github/starred">
          <ArrowLeft className="size-4" />
          Back to starred
        </Link>
      </Button>

      <RepoDetailHeader repo={selectedRepo} />

      <RepoDetailReleases owner={owner} repo={repoName} />

      <div className="grid grid-cols-12 gap-4 md:gap-6">
        <div className="col-span-12 lg:col-span-4">
          <RepoFileTree owner={owner} repo={repoName} />
        </div>
        <div className="col-span-12 lg:col-span-8">
          <RepoDetailReadme owner={owner} repo={repoName} defaultOpen />
        </div>
      </div>
    </div>
  );
}
