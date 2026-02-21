"use client";

import { GithubRepoList } from "@/components/dashboard/github/github-repo-list";
import { GithubActivityFeed } from "@/components/dashboard/github/github-activity-feed";

export default function GithubPage() {
  return (
    <div className="mx-auto max-w-screen-2xl p-4 md:p-6 grid grid-cols-12 gap-4 md:gap-6">
      <div className="col-span-12 xl:col-span-7">
        <GithubRepoList />
      </div>
      <div className="col-span-12 xl:col-span-5">
        <GithubActivityFeed />
      </div>
    </div>
  );
}
