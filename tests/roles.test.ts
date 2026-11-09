import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { EMPTY_CATALOGUE, isDeclared, roleCatalogue } from '@/services/workspace/roles';
import type { Workspace } from '@/services/workspace/types';
import { DEFAULT_WORKSPACE } from '@/services/workspace/types';

/**
 * Roles belong to the hub. These check the dashboard never invents a set of its own — the
 * bug that offered `backend` to a hub whose roles are `api` and `web`.
 */
const ROOT = mkdtempSync(join(tmpdir(), 'wizrelay-gate-roles-'));
const HUB = join(ROOT, 'hub');
const BARE = join(ROOT, 'bare');

const live = (hub: string | null, repos: { path: string; role: string }[] = []): Workspace => ({
  ...DEFAULT_WORKSPACE,
  mode: 'live',
  initialized: true,
  hub: hub ? { url: hub, path: hub, branch: 'main', name: 'hub' } : undefined,
  repos: repos.map((repo, index) => ({ id: `r${index}`, ...repo })),
});

beforeAll(() => {
  mkdirSync(join(HUB, 'tasks', 'CU-1-a'), { recursive: true });
  writeFileSync(
    join(HUB, 'wizrelay-hub.json'),
    JSON.stringify({ name: 'hub', roles: ['api', 'web', 'worker'] }),
  );
  writeFileSync(
    join(HUB, 'tasks', 'CU-1-a', 'task.json'),
    JSON.stringify({ id: 'CU-1', roles: ['api', 'mobile'] }),
  );
  mkdirSync(BARE, { recursive: true });
});

afterAll(() => {
  rmSync(ROOT, { recursive: true, force: true });
});

describe('the role catalogue', () => {
  it('is the hub manifest, in the hub’s own order', async () => {
    const catalogue = await roleCatalogue(live(HUB));
    expect(catalogue.roles).toEqual(['api', 'web', 'worker']);
    expect(catalogue.source).toBe('hub');
  });

  it('names a role a package uses that the hub does not declare', async () => {
    const catalogue = await roleCatalogue(live(HUB));
    expect(catalogue.undeclared).toEqual(['mobile']);
  });

  it('never invents a default set', async () => {
    const catalogue = await roleCatalogue(live(null));
    expect(catalogue).toEqual(EMPTY_CATALOGUE);
    expect(catalogue.roles).not.toContain('backend');
  });

  it('falls back to the roles in use when the manifest cannot be read', async () => {
    const catalogue = await roleCatalogue(live(BARE, [{ path: BARE, role: 'api' }]));
    expect(catalogue.roles).toEqual(['api']);
    expect(catalogue.source).toBe('observed');
  });

  it('re-reads the manifest rather than trusting the stored copy', async () => {
    const stale: Workspace = {
      ...live(HUB),
      hub: { url: HUB, path: HUB, branch: 'main', name: 'hub', roles: ['backend'] },
    };
    const catalogue = await roleCatalogue(stale);
    expect(catalogue.roles).not.toContain('backend');
    expect(catalogue.roles).toContain('web');
  });

  it('answers whether a role belongs to the hub', async () => {
    const catalogue = await roleCatalogue(live(HUB));
    expect(isDeclared(catalogue, 'worker')).toBe(true);
    expect(isDeclared(catalogue, 'backend')).toBe(false);
  });
});
