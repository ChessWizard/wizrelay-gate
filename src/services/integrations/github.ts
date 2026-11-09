import { prisma } from '@/services/db/client';
import { decryptSecret } from '@/services/auth/crypto';
import { isGitHubUrl, orderBranches, parseRepoUrl } from '@/core/integrations/git-url';

const API = 'https://api.github.com';

export interface PullRequest {
  number: number;
  title: string;
  url: string;
  state: string;
  draft: boolean;
  branch: string;
  updatedAt: string;
}

async function tokenFor(userId: string): Promise<string | null> {
  const row = await prisma.connection.findUnique({
    where: { userId_kind: { userId, kind: 'GITHUB' } },
  });
  return decryptSecret(row?.secretEnc) ?? process.env.GITHUB_TOKEN ?? null;
}

interface Answer<T> {
  data: T | null;
  /** The HTTP status, or 0 when the request never reached GitHub. */
  status: number;
  /** What GitHub said went wrong, short enough to put on a screen. */
  message?: string;
}

/**
 * One call to GitHub, with the reason it failed kept.
 *
 * This used to return `null` for everything — a missing token, an expired one, a scope
 * the token does not have, a network that is down — and every caller then had to guess.
 * A screen built on that guessing told people GitHub was not connected when it was, which
 * is worse than saying nothing: it sends them to fix something that is not broken.
 */
async function ask<T>(token: string, path: string): Promise<Answer<T>> {
  try {
    const response = await fetch(`${API}${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      let message: string | undefined;
      try {
        const body = (await response.json()) as { message?: string };
        message = body?.message;
      } catch {
        message = undefined;
      }
      return { data: null, status: response.status, message };
    }

    return { data: (await response.json()) as T, status: response.status };
  } catch (error) {
    return { data: null, status: 0, message: error instanceof Error ? error.message : undefined };
  }
}

async function call<T>(token: string, path: string): Promise<T | null> {
  return (await ask<T>(token, path)).data;
}

/** Open pull requests on a repository whose branch names a relay. */
export async function pullRequestsFor(
  userId: string,
  repo: string,
  relayId: string,
): Promise<PullRequest[]> {
  const token = await tokenFor(userId);
  if (!token || !repo.includes('/')) return [];

  const raw = await call<
    {
      number: number;
      title: string;
      html_url: string;
      state: string;
      draft: boolean;
      head: { ref: string };
      updated_at: string;
    }[]
  >(token, `/repos/${repo}/pulls?state=all&per_page=30`);
  if (!raw) return [];

  const needle = relayId.toLowerCase();
  return raw
    .filter(
      (item) =>
        item.head.ref.toLowerCase().includes(needle) || item.title.toLowerCase().includes(needle),
    )
    .map((item) => ({
      number: item.number,
      title: item.title,
      url: item.html_url,
      state: item.state,
      draft: item.draft,
      branch: item.head.ref,
      updatedAt: item.updated_at,
    }));
}

export async function hasGitHub(userId: string): Promise<boolean> {
  return Boolean(await tokenFor(userId));
}

export interface Repository {
  /** `owner/name`, which is what everything else in the panel calls a repository. */
  fullName: string;
  name: string;
  owner: string;
  description: string | null;
  private: boolean;
  defaultBranch: string;
  cloneUrl: string;
  sshUrl: string;
  pushedAt: string | null;
}

export interface RepositoryListing {
  /** A token is stored, whatever GitHub then made of it. */
  connected: boolean;
  repos: Repository[];
  /** Set when a token exists but the listing could not be read. */
  problem?: { status: number; message?: string };
}

/**
 * The repositories this person's token can reach.
 *
 * Adding a project used to mean picking a folder on the panel's own machine or pasting a
 * clone URL. On a shared panel the first describes a filesystem no gate ever touches, and
 * the second is a line somebody has to copy correctly from somewhere else. The token is
 * already connected, so the panel can simply ask what it can see and let people choose.
 *
 * Whether a token exists and whether GitHub answered are two different facts, and they
 * are reported separately. An empty list used to mean all three of "no token", "the token
 * was refused" and "you have no repositories", so a working connection could be reported
 * as a missing one.
 *
 * Sorted by what was pushed most recently, because the repository somebody is adding is
 * almost always the one they were working in.
 */
export async function listRepositories(userId: string, limit = 100): Promise<RepositoryListing> {
  const token = await tokenFor(userId);
  if (!token) return { connected: false, repos: [] };

  const pages = Math.min(Math.ceil(limit / 100), 3);
  const repos: Repository[] = [];

  for (let page = 1; page <= pages; page += 1) {
    const answer = await ask<
      {
        full_name: string;
        name: string;
        owner: { login: string };
        description: string | null;
        private: boolean;
        default_branch: string;
        clone_url: string;
        ssh_url: string;
        pushed_at: string | null;
      }[]
    >(token, `/user/repos?per_page=100&page=${page}&sort=pushed`);

    if (!answer.data) {
      // A later page that fails leaves the pages already read; a first page that fails
      // is the whole answer, and the reason for it is what the screen needs.
      if (repos.length > 0) break;
      return {
        connected: true,
        repos: [],
        problem: { status: answer.status, message: answer.message },
      };
    }

    if (answer.data.length === 0) break;

    for (const repo of answer.data) {
      repos.push({
        fullName: repo.full_name,
        name: repo.name,
        owner: repo.owner?.login ?? repo.full_name.split('/')[0],
        description: repo.description,
        private: repo.private,
        defaultBranch: repo.default_branch,
        cloneUrl: repo.clone_url,
        sshUrl: repo.ssh_url,
        pushedAt: repo.pushed_at,
      });
    }
    if (answer.data.length < 100) break;
  }

  return { connected: true, repos: repos.slice(0, limit) };
}

/**
 * The branches of a repository, read through this person's own token.
 *
 * The panel used to find these with `git ls-remote`, which authenticates as whatever git
 * identity the panel's machine happens to have. On somebody's laptop that is their own
 * SSH key and it works; in a container on a server there is no identity at all, so a
 * private hub offered no branches to anybody. A token belongs to a person and travels
 * with them, which is what a shared panel needs.
 *
 * Returns null — not an empty list — when it cannot answer, so the caller can fall back
 * to git rather than showing somebody a hub with no branches.
 */
export async function listBranches(userId: string, url: string): Promise<string[] | null> {
  if (!isGitHubUrl(url)) return null;
  const ref = parseRepoUrl(url);
  if (!ref) return null;

  const token = await tokenFor(userId);
  if (!token) return null;

  const names: string[] = [];
  for (let page = 1; page <= 3; page += 1) {
    const answer = await ask<{ name: string }[]>(
      token,
      `/repos/${encodeURIComponent(ref.owner)}/${encodeURIComponent(ref.repo)}/branches?per_page=100&page=${page}`,
    );
    if (!answer.data) return names.length > 0 ? orderBranches(names) : null;
    for (const branch of answer.data) names.push(branch.name);
    if (answer.data.length < 100) break;
  }

  return orderBranches(names);
}

/**
 * A git credential for this person, as a command prefix and the environment to go with it.
 *
 * The token never reaches the command line — `ps` is readable by other processes on the
 * machine, and this panel logs the command it ran. The helper is a shell snippet git runs
 * when the remote asks for credentials; it reads the token out of the environment, which
 * is passed separately.
 */
export async function gitCredential(
  userId: string,
  url: string,
): Promise<{ args: string[]; env: Record<string, string> } | null> {
  if (!/^https?:\/\//i.test(url.trim())) return null;
  const token = await tokenFor(userId);
  if (!token) return null;

  return {
    args: [
      '-c',
      'credential.helper=',
      '-c',
      'credential.helper=!f() { echo username=x-access-token; echo "password=$WIZRELAY_GIT_TOKEN"; }; f',
    ],
    env: { WIZRELAY_GIT_TOKEN: token, GIT_TERMINAL_PROMPT: '0' },
  };
}
