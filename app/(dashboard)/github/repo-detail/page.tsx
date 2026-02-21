"use client";

import { RepoDetailCommits } from "@/components/dashboard/github/repo-detail-commits";
import { RepoDetailContributors } from "@/components/dashboard/github/repo-detail-contributors";
import { RepoDetailHeader } from "@/components/dashboard/github/repo-detail-header";
import { RepoDetailIssues } from "@/components/dashboard/github/repo-detail-issues";
import { RepoDetailPRs } from "@/components/dashboard/github/repo-detail-prs";
import { RepoDetailReadme } from "@/components/dashboard/github/repo-detail-readme";
import { useSelectedRepo } from "@/context/selected-repo-context";
import Link from "next/link";

export default function RepoDetailPage() {
  const { selectedRepo } = useSelectedRepo();

  if (!selectedRepo) {
    return (
      <div className="mx-auto max-w-screen-2xl p-4 md:p-6">
        <div className="flex flex-col items-center justify-center rounded-2xl border bg-card p-12 text-center">
          <p className="text-sm text-muted-foreground">
            No repository selected.
          </p>
          <Link
            href="/github"
            className="mt-3 text-sm font-medium text-foreground underline-offset-4 hover:underline"
          >
            Back to repositories
          </Link>
        </div>
      </div>
    );
  }

  const [owner, repoName] = selectedRepo.full_name.split("/");

  return (
    <div className="mx-auto max-w-screen-2xl p-4 md:p-6 space-y-4 md:space-y-6">
      <RepoDetailHeader repo={selectedRepo} />

      <RepoDetailCommits owner={owner} repo={repoName} />
      <RepoDetailIssues owner={owner} repo={repoName} />
      <RepoDetailPRs owner={owner} repo={repoName} />

      <RepoDetailContributors owner={owner} repo={repoName} />
      <RepoDetailReadme owner={owner} repo={repoName} />
    </div>
  );
}
