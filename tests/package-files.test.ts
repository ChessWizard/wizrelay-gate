import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { criteriaForRole, readPackage } from '@/services/packages/files';
import type { Workspace } from '@/services/workspace/types';
import { DEFAULT_WORKSPACE } from '@/services/workspace/types';

/**
 * A hub and a repository on disk, laid out the way the plugin lays them out, so the reader
 * is exercised against real folders rather than against a mock of itself.
 */
const ROOT = mkdtempSync(join(tmpdir(), 'wizrelay-gate-package-'));
const HUB = join(ROOT, 'hub');
const REPO = join(ROOT, 'repo');
const RELAY = 'CU-86c1abcd';

const workspace: Workspace = {
  ...DEFAULT_WORKSPACE,
  mode: 'live',
  initialized: true,
  hub: { url: HUB, path: HUB, branch: 'main', name: 'hub' },
  repos: [{ id: 'repo', path: REPO, role: 'backend' }],
};

beforeAll(() => {
  const hubTask = join(HUB, 'tasks', `${RELAY}-quota`);
  mkdirSync(join(hubTask, 'roles'), { recursive: true });
  writeFileSync(
    join(hubTask, 'task.json'),
    JSON.stringify({ id: RELAY, title: 'Quota', version: 2, roles: ['backend', 'frontend'] }),
  );
  writeFileSync(
    join(hubTask, 'acceptance.md'),
    [
      '# Acceptance',
      '',
      '## AC-1 [backend] Quota is enforced',
      'Verification: `pytest -q`',
      '',
      '## AC-2 [frontend] The banner appears',
      '',
      '## AC-3 Applies to everyone',
      '',
    ].join('\n'),
  );
  writeFileSync(
    join(hubTask, 'decisions.md'),
    '## D-001 Reject over quota (v1, 2026-01-02)\n\n- Karar: 429 döner\n',
  );
  writeFileSync(join(hubTask, 'scope.md'), 'scope\n');
  writeFileSync(join(hubTask, 'research.md'), 'research with a {{placeholder}} left\n');
  writeFileSync(join(hubTask, 'roles', 'backend.md'), 'role notes\n');
  writeFileSync(join(hubTask, 'cover.png'), 'not text');

  const repoTask = join(REPO, '.wizrelay', 'tasks', `${RELAY}-quota`);
  mkdirSync(repoTask, { recursive: true });
  writeFileSync(join(repoTask, 'acceptance.md'), '## AC-1 [backend] Quota is enforced (pulled)\n');
  writeFileSync(join(repoTask, 'plan.md'), '- [x] one\n- [ ] two\n');
  writeFileSync(join(repoTask, 'verification.md'), 'Result: PASS\n');
});

afterAll(() => {
  rmSync(ROOT, { recursive: true, force: true });
});

describe('reading a package', () => {
  it('collects the hub files and the repository files', async () => {
    const { files } = await readPackage(workspace, RELAY, 'backend');
    const paths = files.map((file) => file.path);
    expect(paths).toContain('task.json');
    expect(paths).toContain('acceptance.md');
    expect(paths).toContain('roles/backend.md');
    expect(paths).toContain('plan.md');
    expect(paths).toContain('verification.md');
  });

  it('skips a file that is not text', async () => {
    const { files } = await readPackage(workspace, RELAY, 'backend');
    expect(files.map((file) => file.path)).not.toContain('cover.png');
  });

  it("lets the repository's copy win, and records where it came from", async () => {
    const { files } = await readPackage(workspace, RELAY, 'backend');
    const acceptance = files.find((file) => file.path === 'acceptance.md');
    expect(acceptance?.source).toBe('repo');
    expect(acceptance?.body).toContain('(pulled)');

    const research = files.find((file) => file.path === 'research.md');
    expect(research?.source).toBe('hub');
  });

  it('marks who owns each file', async () => {
    const { files } = await readPackage(workspace, RELAY, 'backend');
    expect(files.find((file) => file.path === 'plan.md')?.owner).toBe('developer');
    expect(files.find((file) => file.path === 'scope.md')?.owner).toBe('researcher');
  });

  it('counts the placeholders that block publication', async () => {
    const { files } = await readPackage(workspace, RELAY, 'backend');
    expect(files.find((file) => file.path === 'research.md')?.placeholders).toBe(1);
    expect(files.find((file) => file.path === 'scope.md')?.placeholders).toBeUndefined();
  });

  it('orders the package the way a person reads it', async () => {
    const { files } = await readPackage(workspace, RELAY, 'backend');
    const paths = files.map((file) => file.path);
    expect(paths.indexOf('task.json')).toBeLessThan(paths.indexOf('acceptance.md'));
    expect(paths.indexOf('acceptance.md')).toBeLessThan(paths.indexOf('plan.md'));
    expect(paths.indexOf('plan.md')).toBeLessThan(paths.indexOf('roles/backend.md'));
  });

  it('parses what the files say', async () => {
    const { criteria, decisions, plan, task } = await readPackage(workspace, RELAY, 'backend');

    expect(criteria.map((criterion) => criterion.id)).toEqual(['AC-1']);
    expect(decisions[0].decision).toBe('429 döner');
    expect(plan).toHaveLength(2);
    expect(task?.version).toBe(2);
  });

  it('returns an empty package for a relay nobody has', async () => {
    const { files, criteria } = await readPackage(workspace, 'CU-nothing', 'backend');
    expect(files).toEqual([]);
    expect(criteria).toEqual([]);
  });
});

describe('criteria for a role', () => {
  const criteria = [
    { id: 'AC-1', roles: ['backend'], title: 'one' },
    { id: 'AC-2', roles: ['frontend'], title: 'two' },
    { id: 'AC-3', roles: [], title: 'three' },
  ];

  it('keeps the role’s own and the ones that apply to everyone', () => {
    expect(criteriaForRole(criteria, 'backend').map((item) => item.id)).toEqual(['AC-1', 'AC-3']);
  });

  it('keeps everything when no role is given', () => {
    expect(criteriaForRole(criteria)).toHaveLength(3);
  });
});

describe('the demo workspace', () => {
  it('serves the bundled package, because its paths are not real folders', async () => {
    const demo: Workspace = { ...DEFAULT_WORKSPACE, mode: 'demo' };
    const { files, criteria, decisions } = await readPackage(demo, 'CU-86c1abcd', 'backend');
    expect(files.length).toBeGreaterThan(0);
    expect(criteria.length).toBeGreaterThan(0);
    expect(decisions.length).toBeGreaterThan(0);
  });

  it('marks the developer files as coming from a repository', async () => {
    const demo: Workspace = { ...DEFAULT_WORKSPACE, mode: 'demo' };
    const { files } = await readPackage(demo, 'CU-86c1abcd');
    const plan = files.find((file) => file.path === 'plan.md');
    if (plan) expect(plan.source).toBe('repo');
    expect(files.find((file) => file.path === 'task.json')?.source).toBe('hub');
  });
});
