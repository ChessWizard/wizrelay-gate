import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type * as StoreModule from '@/services/store/store';

let store: typeof StoreModule;
let home: string;

beforeAll(async () => {
  home = mkdtempSync(join(tmpdir(), 'wizrelay-gate-test-'));
  process.env.WIZRELAY_GATE_HOME = home;
  store = await import('@/services/store/store');
});

afterAll(() => {
  rmSync(home, { recursive: true, force: true });
  delete process.env.WIZRELAY_GATE_HOME;
});

describe('where the store lives', () => {
  it('is wherever WIZRELAY_GATE_HOME points', () => {
    expect(store.storeRoot()).toBe(resolve(home));
  });

  /**
   * git runs with its working directory already inside the store, so a relative root was
   * resolved twice and clones landed one level deeper than the panel looked.
   */
  it('is absolute even when the variable is relative', async () => {
    const previous = process.env.WIZRELAY_GATE_HOME;
    process.env.WIZRELAY_GATE_HOME = '.wizrelay-gate';
    expect(isAbsolute(store.storeRoot())).toBe(true);
    expect(store.storeRoot()).toBe(resolve('.wizrelay-gate'));
    process.env.WIZRELAY_GATE_HOME = previous;
  });

  it('falls back to a folder beside the project', () => {
    const previous = process.env.WIZRELAY_GATE_HOME;
    delete process.env.WIZRELAY_GATE_HOME;
    expect(store.storeRoot()).toBe(join(process.cwd(), '.wizrelay-gate'));
    process.env.WIZRELAY_GATE_HOME = previous;
  });
});

describe('the workspace file', () => {
  it('starts from the defaults when nothing is stored', async () => {
    const workspace = await store.getWorkspace();
    expect(workspace.initialized).toBe(false);
    expect(workspace.mode).toBe('demo');
    expect(workspace.appearance).toEqual({ direction: 'a', theme: 'dark' });
  });

  it('merges a patch rather than replacing the whole file', async () => {
    await store.saveWorkspace({ locale: 'tr' });
    await store.saveWorkspace({ appearance: { theme: 'light' } });
    const workspace = await store.getWorkspace();
    expect(workspace.locale).toBe('tr');
    expect(workspace.appearance).toEqual({ direction: 'a', theme: 'light' });
  });
});

describe('relays', () => {
  it('round-trips and lists', async () => {
    const relay = {
      id: 'CU-test',
      title: 'A test relay',
      slug: 'a-test-relay',
      tracker: { type: 'none', ref: 'test' },
      version: 1,
      packageStatus: 'draft' as const,
      roles: ['backend'],
      repos: {},
      enforcement: 'strict' as const,
      scope: { backend: { allow: [], deny: [] } },
      hub: { repo: '' },
      createdAt: '2026-11-06T00:00:00.000Z',
      updatedAt: '2026-11-06T00:00:00.000Z',
      tracks: [],
      questions: [],
    };
    await store.saveRelay(relay);
    expect((await store.getRelay('CU-test'))?.title).toBe('A test relay');
    expect((await store.listRelays()).map((item) => item.id)).toContain('CU-test');
  });
});

describe('the event log', () => {
  it('appends and replays from a sequence number', async () => {
    await store.appendEvent('CU-test', 'backend', 'implement', { kind: 'status', status: 'running' }, 1);
    await store.appendEvent(
      'CU-test',
      'backend',
      'implement',
      { kind: 'message', who: 'claude', text: 'hello' },
      2,
    );

    const all = await store.readEvents('CU-test', 'backend', 'implement');
    expect(all).toHaveLength(2);
    expect(all[1].body).toMatchObject({ kind: 'message', text: 'hello' });

    const after = await store.readEvents('CU-test', 'backend', 'implement', 1);
    expect(after).toHaveLength(1);
    expect(after[0].seq).toBe(2);
    expect(await store.countEvents('CU-test', 'backend', 'implement')).toBe(2);
  });

  it('keeps one log per role, so two roles never mix', async () => {
    await store.appendEvent('CU-test', 'frontend', 'implement', { kind: 'status', status: 'idle' }, 1);
    expect(await store.readEvents('CU-test', 'backend', 'implement')).toHaveLength(2);
    expect(await store.readEvents('CU-test', 'frontend', 'implement')).toHaveLength(1);
  });
});
