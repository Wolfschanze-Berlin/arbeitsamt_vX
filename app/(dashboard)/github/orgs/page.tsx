"use client";

import { GithubOrgMembers } from "@/components/dashboard/github/github-org-members";

export default function GithubOrgsPage() {
  return (
    <div className="mx-auto max-w-screen-2xl p-4 md:p-6">
      <GithubOrgMembers />
    </div>
  );
}
