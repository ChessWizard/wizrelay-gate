import { orderBranches } from '@/core/integrations/git-url';
import { readFile, stat } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { doctor as cliDoctor } from '@/services/cli/wizrelay';
import { run, which } from '@/services/shell/exec';
import { ensureHubCopy } from './hub-cache';
import type { HubConnection, RepoConnection } from './types';

/**
 * Connecting a workspace.
 *
 * Reading a repository is all this does; it never writes to one. A URL with credentials
 * in it is refused outright — the plugin refuses those too, and for the same reason: a
 * token in a URL ends up in config files and shell history.
 */
export type HubError = 'empty' | 'credentials' | 'not-a-hub' | 'no-access' | 'invalid';

/**
 * One thing connecting a hub actually does.
 *
 * Connecting is four or five separate operations against someone else's repository, and
 * any of them can be the one that fails. Reporting them individually is what lets the
 * setup screen say "the URL is fine, the clone is fine, the manifest is missing" instead
 * of one red box.
 */
export interface HubStep {
  id: 'url' | 'reach' | 'clone' | 'manifest' | 'packages';
  status: 'passed' | 'failed' | 'skipped';
  detail?: string;
}

export interface HubCheck {
  ok: boolean;
  error?: HubError;
  detail?: string;
  hub?: HubConnection;
  packages?: { total: number; published: number; draft: number };
  /** What was attempted, in order. Present whether the connection succeeded or not. */
  steps: HubStep[];
}

const CREDENTIALS_IN_URL = /^[a-z][a-z0-9+.-]*:\/\/[^/@]*:[^/@]*@/i;

interface HubManifest {
  schema_version?: number;
  name?: string;
  language?: 'en' | 'tr';
  tracker?: { type: string; id_prefix?: string };
  roles?: string[];
  default_branch?: string;
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

async function readManifest(path: string): Promise<HubManifest | null> {
  try {
    return JSON.parse(await readFile(join(path, 'wizrelay-hub.json'), 'utf8')) as HubManifest;
  } catch {
    return null;
  }
}

async function countPackages(path: string): Promise<{ total: number; published: number; draft: number }> {
  const { readdir } = await import('node:fs/promises');
  try {
    const folders = await readdir(join(path, 'tasks'));
    let published = 0;
    let draft = 0;
    for (const folder of folders) {
      try {
        const task = JSON.parse(
          await readFile(join(path, 'tasks', folder, 'task.json'), 'utf8'),
        ) as { status?: string };
        if (task.status === 'published') published += 1;
        else draft += 1;
      } catch {
      }
    }
    return { total: published + draft, published, draft };
  } catch {
    return { total: 0, published: 0, draft: 0 };
  }
}

export async function checkHub(input: string): Promise<HubCheck> {
  const steps: HubStep[] = [];
  const step = (id: HubStep['id'], status: HubStep['status'], detail?: string) => {
    steps.push({ id, status, detail });
  };

  const value = input.trim();
  if (!value) return { ok: false, error: 'empty', steps };
  if (CREDENTIALS_IN_URL.test(value)) {
    step('url', 'failed', 'credentials in the URL');
    return { ok: false, error: 'credentials', steps };
  }

  if (value.startsWith('/') || value.startsWith('~') || value.startsWith('.')) {
    const path = value.startsWith('~') ? join(process.env.HOME ?? '', value.slice(1)) : value;
    step('url', 'passed', path);
    if (!(await isDirectory(path))) {
      step('reach', 'failed', `${path} is not a directory`);
      return { ok: false, error: 'invalid', detail: `${path} is not a directory`, steps };
    }
    step('reach', 'passed', 'local working copy');
    step('clone', 'skipped', 'already on this machine');

    const manifest = await readManifest(path);
    if (!manifest) {
      step('manifest', 'failed', 'wizrelay-hub.json is missing');
      return { ok: false, error: 'not-a-hub', detail: 'wizrelay-hub.json is missing', steps };
    }
    step('manifest', 'passed', manifest.name ?? basename(path));

    const packages = await countPackages(path);
    step('packages', 'passed', String(packages.total));

    return {
      ok: true,
      hub: {
        url: path,
        path,
        branch: manifest.default_branch ?? 'main',
        name: manifest.name ?? basename(path),
        language: manifest.language,
        tracker: manifest.tracker,
        roles: manifest.roles,
        reachable: true,
        lastFetch: new Date().toISOString(),
      },
      packages,
      steps,
    };
  }

  const looksLikeGit = /^(git@|ssh:\/\/|https?:\/\/)/.test(value);
  if (!looksLikeGit) {
    step('url', 'failed', 'not a git URL or a local path');
    return { ok: false, error: 'invalid', detail: 'Not a git URL or a local path', steps };
  }
  step('url', 'passed', value);

  if (!(await which('git'))) {
    step('reach', 'failed', 'git is not on PATH');
    return { ok: false, error: 'no-access', detail: 'git is not on PATH', steps };
  }

  const result = await run('git', ['ls-remote', '--heads', '--', value], {
    cwd: process.cwd(),
    timeoutMs: 25_000,
  });
  if (result.code !== 0) {
    const detail = result.stderr.trim().split('\n')[0] ?? `git exited ${result.code}`;
    step('reach', 'failed', detail);
    return { ok: false, error: 'no-access', detail, steps };
  }

  const branch = /refs\/heads\/(main|master)\b/.exec(result.stdout)?.[1] ?? 'main';
  step('reach', 'passed', `branch ${branch}`);
  const name = value.replace(/\.git$/, '').split(/[:/]/).slice(-2).join('/');
  const hub: HubConnection = { url: value, branch, name, reachable: true };

  const copy = await ensureHubCopy(hub, { force: true });
  if (!copy.path) {
    const detail = copy.error ?? 'the repository could not be cloned';
    step('clone', 'failed', detail);
    return { ok: false, error: 'no-access', detail, steps };
  }
  step('clone', 'passed', copy.path);

  const manifest = await readManifest(copy.path);
  if (!manifest) {
    step('manifest', 'failed', 'wizrelay-hub.json is missing');
    return { ok: false, error: 'not-a-hub', detail: 'wizrelay-hub.json is missing', steps };
  }
  step('manifest', 'passed', manifest.name ?? name);

  const packages = await countPackages(copy.path);
  step('packages', 'passed', String(packages.total));

  return {
    ok: true,
    hub: {
      ...hub,
      branch: manifest.default_branch ?? branch,
      name: manifest.name ?? name,
      language: manifest.language,
      tracker: manifest.tracker,
      roles: manifest.roles,
      lastFetch: copy.fetchedAt ?? new Date().toISOString(),
    },
    packages,
    detail: `Cloned to ${copy.path}`,
    steps,
  };
}

export interface RepoCheck {
  ok: boolean;
  detail?: string;
  repo?: RepoConnection;
  /**
   * Where the role came from. `config` is the repository's own answer and always wins;
   * `chosen` is what the person picked; `unknown` means neither, and the caller must ask
   * rather than let a guess be stored.
   */
  roleSource?: 'config' | 'chosen' | 'unknown';
}

interface DevConfig {
  role?: string;
  base_ref?: string;
  hub?: { repo?: string };
}

interface DevProfile {
  stack?: string;
  commands?: Record<string, string>;
  codebase_size?: 'small' | 'medium' | 'large';
  test_maturity?: 'low' | 'medium' | 'high';
  critical_paths?: string[];
  legacy_paths?: string[];
}

/**
 * The repository's own answer about itself, and nothing else.
 *
 * `checkRepo` spawns git to learn the remote; this reads one small file. Anything that
 * runs on every render uses this one.
 */
export async function readRepoConfig(path: string): Promise<DevConfig | null> {
  try {
    return JSON.parse(await readFile(join(path, '.wizrelay', 'config.json'), 'utf8')) as DevConfig;
  } catch {
    return null;
  }
}

export async function checkRepo(input: string, role?: string): Promise<RepoCheck> {
  const value = input.trim();
  if (!value) return { ok: false, detail: 'empty' };
  const path = value.startsWith('~') ? join(process.env.HOME ?? '', value.slice(1)) : value;
  if (!(await isDirectory(path))) return { ok: false, detail: `${path} is not a directory` };

  let remote: string | undefined;
  if (await which('git')) {
    const result = await run('git', ['remote', 'get-url', 'origin'], { cwd: path, timeoutMs: 10_000 });
    if (result.code === 0) {
      remote = result.stdout
        .trim()
        .replace(/\.git$/, '')
        .split(/[:/]/)
        .slice(-2)
        .join('/');
    }
  }

  let config: DevConfig | null = null;
  let profile: DevProfile | null = null;
  try {
    config = JSON.parse(await readFile(join(path, '.wizrelay', 'config.json'), 'utf8')) as DevConfig;
  } catch {
    config = null;
  }
  try {
    profile = JSON.parse(await readFile(join(path, '.wizrelay', 'profile.json'), 'utf8')) as DevProfile;
  } catch {
    profile = null;
  }

  const resolvedRole = config?.role ?? role ?? '';

  return {
    ok: true,
    roleSource: config?.role ? 'config' : role ? 'chosen' : 'unknown',
    repo: {
      id: basename(path),
      path,
      role: resolvedRole,
      repo: remote,
      baseRef: config?.base_ref ?? 'origin/main',
      profile: profile ?? undefined,
    },
    detail: config ? 'This repository is already connected to a hub.' : 'Not initialised by wizrelay yet.',
  };
}

export interface EnvironmentCheck {
  name: string;
  level: 'error' | 'warn' | 'info';
  detail: string;
  fix?: string;
}

export async function environment(path?: string): Promise<EnvironmentCheck[]> {
  const checks: EnvironmentCheck[] = [];

  for (const binary of ['git', 'python3', 'wizrelay', 'claude'] as const) {
    const found = await which(binary);
    const required = binary === 'git' || binary === 'python3';
    checks.push({
      name: binary,
      level: found ? 'info' : required ? 'error' : 'warn',
      detail: found ?? 'not on PATH',
      fix: found
        ? undefined
        : binary === 'wizrelay'
          ?
            'pip install "git+https://github.com/ChessWizard/wizrelay@main"'
          : binary === 'claude'
            ? 'Install Claude Code to run the conversational gates for real.'
            : undefined,
    });
  }

  if (path) {
    const result = await cliDoctor(path);
    if (result.ok && result.data) {
      for (const check of result.data.checks) {
        checks.push({ name: check.name, level: check.level, detail: check.detail });
      }
    } else if (result.unavailable) {
      checks.push({
        name: 'wizrelay doctor',
        level: 'warn',
        detail: 'skipped — the CLI is not installed',
      });
    } else {
      checks.push({
        name: 'wizrelay doctor',
        level: 'warn',
        detail: result.stderr ?? result.parseError ?? 'could not be read',
      });
    }
  }

  return checks;
}

/**
 * The branches a hub actually has.
 *
 * Typed in, this field was a way to misspell a branch and get a hub that fetches nothing:
 * `git fetch origin mian` fails quietly enough that the panel just shows no packages. Read
 * from the remote, the field becomes a choice between things that exist.
 *
 * `ls-remote` asks the server, not the panel's clone, so a branch pushed five minutes ago
 * is there. It returns an empty list rather than throwing: a hub that cannot be reached
 * right now should leave the branch alone, not clear it.
 */
export async function remoteBranches(url: string, userId?: string): Promise<string[]> {
  if (!url.trim()) return [];

  // The person's own token first. `git ls-remote` authenticates as whatever identity the
  // panel's machine has — somebody's SSH key on a laptop, nothing at all in a container —
  // which is not something a shared panel can rely on.
  if (userId) {
    const { listBranches } = await import('@/services/integrations/github');
    const fromToken = await listBranches(userId, url).catch(() => null);
    if (fromToken && fromToken.length > 0) return fromToken;
  }

  if (!(await which('git'))) return [];
  try {
    const credential = userId
      ? await (await import('@/services/integrations/github')).gitCredential(userId, url)
      : null;

    const result = await run(
      'git',
      [...(credential?.args ?? []), 'ls-remote', '--heads', '--', url],
      { cwd: process.cwd(), timeoutMs: 25_000, env: credential?.env },
    );
    if (result.code !== 0) return [];
    const names = [...result.stdout.matchAll(/refs\/heads\/(\S+)/g)].map((match) => match[1]);
    return orderBranches(names);
  } catch {
    return [];
  }
}
