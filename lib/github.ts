/**
 * Centralized GitHub API client.
 *
 * Uses `@tauri-apps/plugin-http` for CORS-free HTTP requests
 * and `lib/tauri.ts` to retrieve the stored GitHub token.
 */

import { tauriInvoke } from "@/lib/tauri";

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

export type GithubErrorKind =
  | "Unauthorized"
  | "RateLimited"
  | "NotFound"
  | "NetworkError"
  | "Unknown";

export class GithubError extends Error {
  constructor(
    public readonly kind: GithubErrorKind,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "GithubError";
  }
}

// ---------------------------------------------------------------------------
// Response types (subset of GitHub API shapes)
// ---------------------------------------------------------------------------

export interface GithubUser {
  login: string;
  id: number;
  avatar_url: string;
  html_url: string;
  name: string | null;
  company: string | null;
  blog: string | null;
  location: string | null;
  email: string | null;
  bio: string | null;
  public_repos: number;
  public_gists: number;
  followers: number;
  following: number;
  created_at: string;
  updated_at: string;
}

export interface GithubRepo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
  description: string | null;
  fork: boolean;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  default_branch: string;
  created_at: string;
  updated_at: string;
  pushed_at: string;
}

export interface GithubOrg {
  login: string;
  id: number;
  avatar_url: string;
  description: string | null;
}

export interface GithubOrgMember {
  login: string;
  id: number;
  avatar_url: string;
  html_url: string;
  role_name?: string;
}

export interface GithubEvent {
  id: string;
  type: string | null;
  actor: { login: string; avatar_url: string };
  repo: { id: number; name: string };
  created_at: string | null;
  payload: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Core fetcher
// ---------------------------------------------------------------------------

const GITHUB_API = "https://api.github.com";

async function tauriFetch(
  input: string,
  init?: RequestInit,
): Promise<Response> {
  const { fetch } = await import("@tauri-apps/plugin-http");
  return fetch(input, init);
}

function errorKindFromStatus(status: number): GithubErrorKind {
  if (status === 401) return "Unauthorized";
  if (status === 403) return "RateLimited";
  if (status === 404) return "NotFound";
  return "Unknown";
}

async function fetchGithub<T>(
  endpoint: string,
  options?: RequestInit,
): Promise<T> {
  const token = await tauriInvoke<string>("get_github_token");

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    ...(options?.headers as Record<string, string> | undefined),
  };

  let response: Response;
  try {
    response = await tauriFetch(`${GITHUB_API}${endpoint}`, {
      ...options,
      headers,
    });
  } catch (err) {
    throw new GithubError(
      "NetworkError",
      err instanceof Error ? err.message : "Network request failed",
    );
  }

  if (!response.ok) {
    const kind = errorKindFromStatus(response.status);
    const body = await response.text().catch(() => "");
    throw new GithubError(kind, body || response.statusText, response.status);
  }

  return response.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Typed fetcher functions
// ---------------------------------------------------------------------------

export function getAuthenticatedUser(): Promise<GithubUser> {
  return fetchGithub<GithubUser>("/user");
}

export function getUserRepos(
  page = 1,
  perPage = 30,
): Promise<GithubRepo[]> {
  return fetchGithub<GithubRepo[]>(
    `/user/repos?sort=updated&page=${page}&per_page=${perPage}`,
  );
}

export function getUserActivity(
  username: string,
  page = 1,
  perPage = 30,
): Promise<GithubEvent[]> {
  return fetchGithub<GithubEvent[]>(
    `/users/${encodeURIComponent(username)}/events?page=${page}&per_page=${perPage}`,
  );
}

export function getUserOrgs(): Promise<GithubOrg[]> {
  return fetchGithub<GithubOrg[]>("/user/orgs");
}

export function getOrgMembers(orgName: string): Promise<GithubOrgMember[]> {
  return fetchGithub<GithubOrgMember[]>(
    `/orgs/${encodeURIComponent(orgName)}/members`,
  );
}
