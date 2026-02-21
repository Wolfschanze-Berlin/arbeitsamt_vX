"use client";

import {
  GitBranch,
  Plus,
  Star,
  GitFork,
  CircleDot,
  GitPullRequest,
  Activity,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useAuthenticatedUser, useUserActivity } from "@/hooks/useGithub";
import { Skeleton } from "@/components/ui/skeleton";
import type { GithubEvent } from "@/lib/github";

type EventMapping = {
  icon: React.ElementType;
  label: (repo: string) => string;
};

const EVENT_MAP: Record<string, EventMapping> = {
  PushEvent: { icon: GitBranch, label: (r) => `Pushed to ${r}` },
  CreateEvent: { icon: Plus, label: (r) => `Created ${r}` },
  WatchEvent: { icon: Star, label: (r) => `Starred ${r}` },
  ForkEvent: { icon: GitFork, label: (r) => `Forked ${r}` },
  IssuesEvent: { icon: CircleDot, label: (r) => `Issue on ${r}` },
  PullRequestEvent: { icon: GitPullRequest, label: (r) => `PR on ${r}` },
};

function getEventInfo(event: GithubEvent) {
  const mapping = event.type ? EVENT_MAP[event.type] : undefined;
  const repoName = event.repo.name;
  if (mapping) {
    return { Icon: mapping.icon, label: mapping.label(repoName) };
  }
  return {
    Icon: Activity,
    label: `${event.type ?? "Event"} on ${repoName}`,
  };
}

function FeedSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-start gap-3">
          <Skeleton className="size-8 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function GithubActivityFeed() {
  const { data: user } = useAuthenticatedUser();
  const {
    data: events,
    isLoading,
    error,
  } = useUserActivity(user?.login, 1, 10);

  const isWaiting = !user || isLoading;

  return (
    <div className="rounded-2xl border bg-card p-5 md:p-6">
      <h3 className="mb-4 text-lg font-semibold text-foreground">
        Recent Activity
      </h3>

      {isWaiting && <FeedSkeleton />}

      {!isWaiting && error && !events && (
        <p className="text-sm text-muted-foreground">
          Failed to load activity.
        </p>
      )}

      {!isWaiting && events && events.length === 0 && (
        <p className="text-sm text-muted-foreground">No recent activity</p>
      )}

      {!isWaiting && events && events.length > 0 && (
        <ul className="space-y-4">
          {events.map((event) => {
            const { Icon, label } = getEventInfo(event);
            return (
              <li key={event.id} className="flex items-start gap-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
                  <Icon className="size-4 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-foreground">{label}</p>
                  <p className="text-xs text-muted-foreground">
                    {event.created_at
                      ? formatDistanceToNow(new Date(event.created_at), {
                          addSuffix: true,
                        })
                      : "Unknown time"}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
