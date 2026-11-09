import { createHash } from 'node:crypto';
import { mkdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { run, which } from '@/services/shell/exec';
import { storeRoot } from '@/services/store/store';
import type { HubConnection } from './types';

/**
 * The local copy of a hub.
 *
 * A hub connected by link has to exist on disk before its packages can be read, so the
 * dashboard keeps a shallow clone the way the plugin keeps its own cache: one directory
 * per hub, named from the repository and a hash of the URL, so two hubs can never share
 * one. A hub connected by path is the user's own working copy and is never touched — no
 * fetch, no reset, exactly as the plugin promises.
 */
const DEFAULT_TTL_MINUTES = 10;

export function hubCachePath(url: string): string {
  const slug = url
    .replace(/\.git$/, '')
    .split(/[:/]/)
    .slice(-2)
    .join('-')
    .replace(/[^A-Za-z0-9._-]/g, '-')
    .toLowerCase();
  const hash = createHash('sha256').update(url).digest('hex').slice(0, 8);
  return join(storeRoot(), 'hubs', `${slug}-${hash}`);
}

/** Delete the panel's own clone of a hub. A mounted working copy is never passed here. */
export async function dropHubCache(url: string): Promise<void> {
  const path = hubCachePath(url);
  if (!path.startsWith(join(storeRoot(), 'hubs'))) return;
  const { rm } = await import('node:fs/promises');
  try {
    await rm(path, { recursive: true, force: true });
  } catch {
  }
}

export interface HubCopy {
  /** Where the packages can be read, when there is somewhere to read them. */
  path?: string;
  /** True when this is the user's own working copy rather than our clone. */
  local: boolean;
  fetchedAt?: string;
  error?: string;
  command?: string;
}

async function isGitDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(join(path, '.git'))).isDirectory();
  } catch {
    return false;
  }
}

async function isStale(fetchedAt: string | undefined, ttlMinutes: number): Promise<boolean> {
  if (!fetchedAt) return true;
  const age = Date.now() - new Date(fetchedAt).getTime();
  return Number.isNaN(age) || age > ttlMinutes * 60_000;
}

/** One clone or fetch at a time per hub, however many screens ask for it at once. */
interface CacheRegistry {
  inFlight: Map<string, Promise<HubCopy>>;
}
const globalRegistry = globalThis as typeof globalThis & { __wizrelayGateHubs?: CacheRegistry };

function registry(): CacheRegistry {
  if (!globalRegistry.__wizrelayGateHubs) globalRegistry.__wizrelayGateHubs = { inFlight: new Map() };
  return globalRegistry.__wizrelayGateHubs;
}

/**
 * The hub's packages, as fast as they can be given.
 *
 * Measured at 1147ms against 5ms for reading every package in it: a page that waits for
 * `git fetch` spends nearly all of its time waiting for a network round trip to decide
 * nothing has changed. Every screen reads the board, so every screen paid it.
 *
 * So a clone that already exists is returned at once and refreshed behind the request.
 * The packages on screen are from the last completed fetch — which is what "fetched four
 * minutes ago" has always meant — and the next page sees whatever the background fetch
 * brought. Only the first time, when there is nothing on disk to read, does a caller wait.
 *
 * `force` still waits. It is what a person pressing refresh means.
 */
export async function ensureHubCopy(
  hub: HubConnection,
  options: { ttlMinutes?: number; force?: boolean; userId?: string } = {},
): Promise<HubCopy> {
  if (hub.path) return { path: hub.path, local: true };
  if (!hub.url) return { local: false, error: 'no hub is connected' };

  const key = hub.url;

  /** Join the fetch already running for this hub, or begin one. One at a time, per hub. */
  const work = (): Promise<HubCopy> => {
    const pending = registry().inFlight.get(key);
    if (pending) return pending;
    const started = fetchHub(hub, options).finally(() => registry().inFlight.delete(key));
    registry().inFlight.set(key, started);
    return started;
  };

  if (options.force) return work();

  const path = hubCachePath(hub.url);

  if (!(await isGitDirectory(path))) return work();

  // No recorded fetch at all means the clone is not known to hold what the panel now
  // wants — a hub whose branch was just changed records exactly that. Waiting here costs
  // one slow read; not waiting serves the previous branch's packages as though they were
  // the new branch's, which is a wrong answer rather than a slow one.
  if (!hub.lastFetch) return work();

  const ttl = options.ttlMinutes ?? DEFAULT_TTL_MINUTES;
  if (await isStale(hub.lastFetch, ttl)) {
    void work().catch(() => {});
  }

  return { path, local: false, fetchedAt: hub.lastFetch };
}

async function fetchHub(
  hub: HubConnection,
  options: { ttlMinutes?: number; force?: boolean; userId?: string },
): Promise<HubCopy> {
  const path = hubCachePath(hub.url);
  const branch = hub.branch || 'main';
  const ttl = options.ttlMinutes ?? DEFAULT_TTL_MINUTES;

  /**
   * Who the panel is when it reads the hub.
   *
   * Without this it is whatever git identity the machine has: somebody's SSH key on a
   * laptop, and nothing at all in a container — so a private hub could not be read on the
   * one deployment the panel is built for. The token belongs to whoever is looking, and
   * it is passed through the environment rather than the command line, which is visible
   * to other processes and is written into this panel's own logs.
   */
  const credential = options.userId
    ? await (await import('@/services/integrations/github'))
        .gitCredential(options.userId, hub.url)
        .catch(() => null)
    : null;
  const as = credential?.args ?? [];
  const withToken = credential?.env;

  if (!(await which('git'))) {
    return { path: undefined, local: false, error: 'git is not on PATH' };
  }

  const root = storeRoot();
  await mkdir(join(root, 'hubs'), { recursive: true });

  const cloned = await isGitDirectory(path);

  if (!cloned) {
    const result = await run(
      'git',
      [...as, 'clone', '--depth', '1', '--branch', branch, '--', hub.url, path],
      { cwd: root, timeoutMs: 180_000, env: withToken },
    );
    if (result.code !== 0) {
      return {
        local: false,
        command: result.command,
        error: result.stderr.trim().split('\n').slice(-1)[0] || `git exited ${result.code}`,
      };
    }
    return { path, local: false, fetchedAt: new Date().toISOString(), command: result.command };
  }

  if (!options.force && !(await isStale(hub.lastFetch, ttl))) {
    return { path, local: false, fetchedAt: hub.lastFetch };
  }

  const fetched = await run('git', [...as, 'fetch', '--depth', '1', 'origin', branch], {
    cwd: path,
    timeoutMs: 120_000,
    env: withToken,
  });
  if (fetched.code !== 0) {
    return {
      path,
      local: false,
      fetchedAt: hub.lastFetch,
      command: fetched.command,
      error: fetched.stderr.trim().split('\n').slice(-1)[0] || `git exited ${fetched.code}`,
    };
  }

  // The mirror is always the hub's branch. A gate that ran here before this was enforced
  // could have left it on a task branch, and a mirror sitting on someone's half-written
  // branch answers every read with the wrong packages.
  await run('git', [...as, 'checkout', '-B', branch, `origin/${branch}`], {
    cwd: path,
    timeoutMs: 60_000,
    env: withToken,
  });
  await run('git', ['reset', '--hard', `origin/${branch}`], { cwd: path, timeoutMs: 60_000 });

  const fetchedAt = new Date().toISOString();
  await recordFetch(hub.url, fetchedAt);
  return { path, local: false, fetchedAt, command: fetched.command };
}

/** Imported directly rather than through `panel/workspace`, which reads this module. */
async function recordFetch(url: string, at: string): Promise<void> {
  try {
    const { prisma } = await import('@/services/db/client');
    await prisma.hub.updateMany({ where: { url }, data: { fetchedAt: new Date(at) } });
  } catch {
  }
}
