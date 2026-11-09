import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { TaskPackage } from '@/core/relay/types';
import { hubCachePath } from './hub-cache';
import type { Workspace } from './types';

/**
 * The role catalogue — one source of truth for every list of roles in the app.
 *
 * Roles are a property of the hub: `wizrelay-hub.json` declares which ones that team
 * works with, and the plugin matches a repository to one of them. So the dashboard reads
 * the manifest rather than carrying a list of its own. There is no default set; a hub that
 * works with `api` and `web` must never be offered `backend`.
 *
 * The manifest is re-read from the working copy on every call rather than trusted from the
 * workspace file, because a hub that adds a role should show it without anyone going back
 * through setup.
 */
export interface RoleCatalogue {
  /** The hub's roles, in the hub's own order. */
  roles: string[];
  /**
   * Where the list came from. `hub` is the catalogue; `observed` is what the connected
   * repositories and published packages happen to use, which is a fallback, not a
   * catalogue; `none` means nothing is connected yet and the UI must say so.
   */
  source: 'hub' | 'observed' | 'none';
  /** Roles in use that the hub does not declare — a real mismatch worth showing. */
  undeclared: string[];
}

export const EMPTY_CATALOGUE: RoleCatalogue = { roles: [], source: 'none', undeclared: [] };

interface HubManifest {
  roles?: string[];
}

async function manifestRoles(path: string): Promise<string[] | null> {
  try {
    const raw = await readFile(join(path, 'wizrelay-hub.json'), 'utf8');
    const manifest = JSON.parse(raw) as HubManifest;
    const roles = manifest.roles?.filter((role) => typeof role === 'string' && role.trim());
    return roles && roles.length > 0 ? roles : null;
  } catch {
    return null;
  }
}

/** Roles the published packages actually name, which is what the board will show. */
async function packageRoles(hubPath: string): Promise<string[]> {
  const found = new Set<string>();
  try {
    for (const folder of await readdir(join(hubPath, 'tasks'))) {
      try {
        const raw = await readFile(join(hubPath, 'tasks', folder, 'task.json'), 'utf8');
        for (const role of (JSON.parse(raw) as TaskPackage).roles ?? []) found.add(role);
      } catch {
      }
    }
  } catch {
  }
  return [...found];
}

export function hubWorkingCopy(workspace: Workspace): string | null {
  if (!workspace.hub) return null;
  return workspace.hub.path ?? hubCachePath(workspace.hub.url);
}

/**
 * Whether the only hub this machine has is the panel's read mirror.
 *
 * The mirror is a shallow clone the panel keeps so it can read packages; it is refreshed
 * with `git reset --hard`, so anything written into it disappears the next time the cache
 * goes stale. A gate that writes to the hub must not run there — it would look like it
 * worked, and the work would be gone ten minutes later.
 */
export function hubIsMirror(workspace: Workspace): boolean {
  return Boolean(workspace.hub && !workspace.hub.path);
}

export async function roleCatalogue(workspace: Workspace): Promise<RoleCatalogue> {
  const inUse = new Set(workspace.repos.map((repo) => repo.role).filter(Boolean));

  const hubPath = hubWorkingCopy(workspace);
  if (hubPath) {
    for (const role of await packageRoles(hubPath)) inUse.add(role);

    const declared = (await manifestRoles(hubPath)) ?? workspace.hub?.roles ?? null;
    if (declared) {
      return {
        roles: declared,
        source: 'hub',
        undeclared: [...inUse].filter((role) => !declared.includes(role)).sort(),
      };
    }
  }

  const observed = [...inUse].sort();
  if (observed.length > 0) return { roles: observed, source: 'observed', undeclared: [] };
  return EMPTY_CATALOGUE;
}

/** Whether a role belongs to this hub, for a repository the user is about to connect. */
export function isDeclared(catalogue: RoleCatalogue, role: string): boolean {
  return catalogue.roles.includes(role);
}
