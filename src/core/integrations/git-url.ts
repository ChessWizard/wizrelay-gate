/**
 * Reading `owner/repo` out of a git URL.
 *
 * The panel is handed repository URLs in every form people write them — HTTPS with and
 * without `.git`, `git@host:owner/repo`, `ssh://git@host/owner/repo` — and has to decide
 * whether it can ask GitHub's API about them. Guessing wrong means asking api.github.com
 * about somebody's self-hosted GitLab, so the host is checked rather than assumed.
 */
export interface RepoRef {
  host: string;
  owner: string;
  repo: string;
}

export function parseRepoUrl(url: string): RepoRef | null {
  const raw = url.trim();
  if (!raw) return null;

  // `user@host:path`, or `host:path` where the host looks like one. Without that second
  // condition `javascript:alert(1)//a/b` parses as the host `javascript`, and a string
  // that is not a URL at all would be treated as a repository.
  const scp = /^(?:([\w.-]+)@)?([\w.-]+):(?!\/)(.+)$/.exec(raw);
  const scpHostLooksReal = Boolean(scp && (scp[1] || scp[2].includes('.')));
  let host: string;
  let path: string;

  if (scp && scpHostLooksReal) {
    host = scp[2].toLowerCase();
    path = scp[3];
  } else {
    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      return null;
    }
    if (!/^(https?|ssh|git):$/.test(parsed.protocol)) return null;
    host = parsed.hostname.toLowerCase();
    path = parsed.pathname;
  }

  const parts = path
    .replace(/\.git$/i, '')
    .split('/')
    .filter(Boolean);
  if (parts.length < 2) return null;

  return { host, owner: parts[parts.length - 2], repo: parts[parts.length - 1] };
}

/** Whether this URL is one github.com's API can answer about. */
export function isGitHubUrl(url: string): boolean {
  const ref = parseRepoUrl(url);
  return ref?.host === 'github.com' || ref?.host === 'www.github.com';
}

/**
 * The order branches are offered in.
 *
 * `main` and `master` first because one of them is what somebody wants nine times out of
 * ten, and the rest alphabetically so a long list is scannable.
 */
export function orderBranches(names: string[]): string[] {
  const rank = (name: string) => (name === 'main' ? 0 : name === 'master' ? 1 : 2);
  return [...new Set(names)].sort(
    (left, right) => rank(left) - rank(right) || left.localeCompare(right),
  );
}
