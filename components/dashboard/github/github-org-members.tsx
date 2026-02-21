"use client";

import { useEffect, useState } from "react";
import { Building2, ExternalLink } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useUserOrgs, useOrgMembers } from "@/hooks/useGithub";

// ---------------------------------------------------------------------------
// External link helper — Tauri opener with web fallback
// ---------------------------------------------------------------------------

async function openProfile(url: string) {
  try {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(url);
  } catch {
    window.open(url, "_blank");
  }
}

// ---------------------------------------------------------------------------
// Skeleton placeholders
// ---------------------------------------------------------------------------

function OrgTabsSkeleton() {
  return (
    <div className="flex gap-2 overflow-x-auto">
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-9 w-32 shrink-0 rounded-full" />
      ))}
    </div>
  );
}

function MemberGridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="flex items-center gap-2.5 rounded-lg p-2">
          <Skeleton className="size-10 shrink-0 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="h-3 w-14" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function GithubOrgMembers() {
  const { data: orgs, isLoading: orgsLoading } = useUserOrgs();
  const [selectedOrg, setSelectedOrg] = useState<string | null>(null);
  const { data: members, isLoading: membersLoading } = useOrgMembers(selectedOrg);

  // Auto-select first org once loaded
  useEffect(() => {
    if (orgs?.length && !selectedOrg) {
      setSelectedOrg(orgs[0].login);
    }
  }, [orgs, selectedOrg]);

  // Empty state — no orgs
  if (!orgsLoading && orgs && orgs.length === 0) {
    return (
      <div className="rounded-2xl border bg-card p-5 md:p-6">
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <Building2 className="size-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            You don&apos;t belong to any organizations
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border bg-card p-5 md:p-6">
      <h3 className="mb-4 text-lg font-semibold text-foreground">
        Organizations
      </h3>

      {/* Org selector tabs */}
      {orgsLoading ? (
        <OrgTabsSkeleton />
      ) : (
        <div className="flex flex-wrap gap-2">
          {orgs?.map((org) => (
            <Button
              key={org.id}
              variant={selectedOrg === org.login ? "default" : "outline"}
              size="sm"
              className="gap-2 rounded-full"
              onClick={() => setSelectedOrg(org.login)}
            >
              <img
                src={org.avatar_url}
                alt={org.login}
                className="size-5 rounded-full"
              />
              {org.login}
            </Button>
          ))}
        </div>
      )}

      {/* Member grid */}
      <div className="mt-5">
        {membersLoading || orgsLoading ? (
          <MemberGridSkeleton />
        ) : members && members.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {members.map((member) => (
              <button
                key={member.id}
                type="button"
                onClick={() => openProfile(member.html_url)}
                className="flex items-center gap-2.5 rounded-lg p-2 text-left transition-colors hover:bg-accent"
              >
                <img
                  src={member.avatar_url}
                  alt={member.login}
                  className="size-10 shrink-0 rounded-full border border-border"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {member.login}
                  </p>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    @{member.login}
                    <ExternalLink className="size-3" />
                  </span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No members found
          </p>
        )}
      </div>
    </div>
  );
}
