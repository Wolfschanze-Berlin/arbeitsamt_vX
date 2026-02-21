"use client";

import useSWR, { type SWRConfiguration } from "swr";
import {
  getAuthenticatedUser,
  getUserRepos,
  getUserStarredRepos,
  getUserActivity,
  getUserOrgs,
  getOrgMembers,
  getRepoReadme,
  getRepoCommits,
  getRepoIssues,
  getRepoPRs,
  getRepoContributors,
  getRepoContents,
  getRepoReleases,
  type GithubUser,
  type GithubRepo,
  type GithubEvent,
  type GithubOrg,
  type GithubOrgMember,
  type GithubReadme,
  type GithubCommit,
  type GithubIssue,
  type GithubPR,
  type GithubContributor,
  type GithubContent,
  type GithubRelease,
} from "@/lib/github";
import { tauriInvoke } from "@/lib/tauri";
import { loadCache, saveCache } from "@/lib/github-cache";

// ---------------------------------------------------------------------------
// Shared SWR config — keep stale data on error (offline-friendly)
// ---------------------------------------------------------------------------

const OFFLINE_CONFIG: SWRConfiguration = {
  revalidateOnFocus: false,
  shouldRetryOnError: false,
  keepPreviousData: true,
};

// ---------------------------------------------------------------------------
// Cache-aware fetcher factory
// ---------------------------------------------------------------------------

function withCache<T>(cacheKey: string, fetcher: () => Promise<T>) {
  return async (): Promise<T> => {
    const cached = await loadCache<T>(cacheKey);
    if (cached) return cached;

    const data = await fetcher();
    void saveCache(cacheKey, data);
    return data;
  };
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/** Token retrieval — cached for the session. */
export function useGithubToken() {
  return useSWR<string>(
    "github:token",
    () => tauriInvoke<string>("get_github_token"),
    { ...OFFLINE_CONFIG, revalidateOnMount: false },
  );
}

/** Authenticated user profile. */
export function useAuthenticatedUser() {
  return useSWR<GithubUser>(
    "github:user",
    withCache("profile:user", getAuthenticatedUser),
    OFFLINE_CONFIG,
  );
}

/** User repositories (paginated). */
export function useUserRepos(page = 1, perPage = 30) {
  return useSWR<GithubRepo[]>(
    `github:repos:${page}:${perPage}`,
    withCache(`repos:${page}:${perPage}`, () => getUserRepos(page, perPage)),
    OFFLINE_CONFIG,
  );
}

/** Starred repositories for the authenticated user (paginated). */
export function useUserStarredRepos(page = 1, perPage = 30) {
  return useSWR<GithubRepo[]>(
    `github:starred:${page}:${perPage}`,
    withCache(`starred:${page}:${perPage}`, () =>
      getUserStarredRepos(page, perPage),
    ),
    OFFLINE_CONFIG,
  );
}

/** User public events (requires username). */
export function useUserActivity(
  username: string | undefined,
  page = 1,
  perPage = 10,
) {
  return useSWR<GithubEvent[]>(
    username ? `github:activity:${username}:${page}` : null,
    username
      ? withCache(`activity:${username}:${page}`, () =>
          getUserActivity(username, page, perPage),
        )
      : null,
    OFFLINE_CONFIG,
  );
}

/** Organizations the authenticated user belongs to. */
export function useUserOrgs() {
  return useSWR<GithubOrg[]>(
    "github:orgs",
    withCache("orgs:list", getUserOrgs),
    OFFLINE_CONFIG,
  );
}

/** Members of a specific organization (lazy — pass `null` orgName to skip). */
export function useOrgMembers(orgName: string | null) {
  return useSWR<GithubOrgMember[]>(
    orgName ? `github:org-members:${orgName}` : null,
    orgName
      ? withCache(`orgs:members:${orgName}`, () => getOrgMembers(orgName))
      : null,
    OFFLINE_CONFIG,
  );
}

/** README for a specific repository (lazy — pass `null` to skip). */
export function useRepoReadme(owner: string | null, repo: string | null) {
  return useSWR<GithubReadme>(
    owner && repo ? `repo:readme:${owner}/${repo}` : null,
    owner && repo
      ? withCache(`repo:readme:${owner}/${repo}`, () =>
          getRepoReadme(owner, repo),
        )
      : null,
    OFFLINE_CONFIG,
  );
}

/** Commits for a specific repository (lazy — pass `null` to skip). */
export function useRepoCommits(owner: string | null, repo: string | null) {
  return useSWR<GithubCommit[]>(
    owner && repo ? `repo:commits:${owner}/${repo}` : null,
    owner && repo
      ? withCache(`repo:commits:${owner}/${repo}`, () =>
          getRepoCommits(owner, repo),
        )
      : null,
    OFFLINE_CONFIG,
  );
}

/** Issues for a specific repository (lazy — pass `null` to skip). */
export function useRepoIssues(owner: string | null, repo: string | null) {
  return useSWR<GithubIssue[]>(
    owner && repo ? `repo:issues:${owner}/${repo}` : null,
    owner && repo
      ? withCache(`repo:issues:${owner}/${repo}`, () =>
          getRepoIssues(owner, repo),
        )
      : null,
    OFFLINE_CONFIG,
  );
}

/** Pull requests for a specific repository (lazy — pass `null` to skip). */
export function useRepoPRs(owner: string | null, repo: string | null) {
  return useSWR<GithubPR[]>(
    owner && repo ? `repo:prs:${owner}/${repo}` : null,
    owner && repo
      ? withCache(`repo:prs:${owner}/${repo}`, () =>
          getRepoPRs(owner, repo),
        )
      : null,
    OFFLINE_CONFIG,
  );
}

/** Contributors for a specific repository (lazy — pass `null` to skip). */
export function useRepoContributors(owner: string | null, repo: string | null) {
  return useSWR<GithubContributor[]>(
    owner && repo ? `repo:contributors:${owner}/${repo}` : null,
    owner && repo
      ? withCache(`repo:contributors:${owner}/${repo}`, () =>
          getRepoContributors(owner, repo),
        )
      : null,
    OFFLINE_CONFIG,
  );
}

/** Latest releases for a specific repository (lazy — pass `null` to skip). */
export function useRepoReleases(owner: string | null, repo: string | null) {
  return useSWR<GithubRelease[]>(
    owner && repo ? `repo:releases:${owner}/${repo}` : null,
    owner && repo
      ? withCache(`repo:releases:${owner}/${repo}`, () =>
          getRepoReleases(owner, repo),
        )
      : null,
    OFFLINE_CONFIG,
  );
}

/** Directory contents for a specific path (lazy — pass `null` owner/repo to skip). */
export function useRepoContents(
  owner: string | null,
  repo: string | null,
  path = "",
) {
  return useSWR<GithubContent[]>(
    owner && repo ? `repo:contents:${owner}/${repo}:${path}` : null,
    owner && repo
      ? withCache(`repo:contents:${owner}/${repo}:${path}`, () =>
          getRepoContents(owner, repo, path),
        )
      : null,
    OFFLINE_CONFIG,
  );
}
