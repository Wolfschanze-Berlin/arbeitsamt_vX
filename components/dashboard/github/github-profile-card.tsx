"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { useAuthenticatedUser } from "@/hooks/useGithub";

export function GithubProfileCard() {
  const { data: user, isLoading, error } = useAuthenticatedUser();

  if (isLoading) {
    return (
      <div className="flex items-center gap-3">
        <Skeleton className="size-10 rounded-full" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <p className="text-sm text-muted-foreground">GitHub unavailable</p>
    );
  }

  return (
    <div className="flex items-start gap-3">
      <img
        src={user.avatar_url}
        alt={user.login}
        className="size-10 shrink-0 rounded-full border border-border"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">
          {user.name ?? user.login}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          @{user.login}
        </p>
        {user.bio && (
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
            {user.bio}
          </p>
        )}
      </div>
    </div>
  );
}
