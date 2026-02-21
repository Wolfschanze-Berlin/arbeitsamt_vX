"use client";

import { AlertTriangle, WifiOff, ShieldAlert, type LucideIcon } from "lucide-react";
import { GithubError, type GithubErrorKind } from "@/lib/github";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

type GithubErrorBannerProps = {
  error: Error | undefined;
  className?: string;
};

type GithubStaleIndicatorProps = {
  lastUpdated: Date | undefined;
  className?: string;
};

const errorConfig: Record<GithubErrorKind, { icon: LucideIcon; message: string }> = {
  Unauthorized:  { icon: ShieldAlert,   message: "Invalid token \u2014 check GITHUB_TOKEN in .env" },
  RateLimited:   { icon: AlertTriangle, message: "Rate limited \u2014 try again later" },
  NotFound:      { icon: AlertTriangle, message: "Resource not found" },
  NetworkError:  { icon: WifiOff,       message: "Network error \u2014 check your connection" },
  Unknown:       { icon: AlertTriangle, message: "Something went wrong" },
};

export function GithubErrorBanner({ error, className }: GithubErrorBannerProps) {
  if (!error) return null;

  const kind: GithubErrorKind =
    error instanceof GithubError ? error.kind : "Unknown";
  const { icon: Icon, message } = errorConfig[kind];

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive",
        className,
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

export function GithubStaleIndicator({ lastUpdated, className }: GithubStaleIndicatorProps) {
  if (!lastUpdated) return null;

  return (
    <span className={cn("text-xs text-muted-foreground", className)}>
      Updated {formatDistanceToNow(lastUpdated, { addSuffix: true })}
    </span>
  );
}
