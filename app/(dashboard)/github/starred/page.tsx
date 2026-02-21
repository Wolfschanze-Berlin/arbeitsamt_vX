"use client";

import { GithubStarredList } from "@/components/dashboard/github/github-starred-list";

export default function StarredPage() {
  return (
    <div className="mx-auto max-w-screen-2xl p-4 md:p-6">
      <GithubStarredList />
    </div>
  );
}
