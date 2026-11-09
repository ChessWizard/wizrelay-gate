import { describe, expect, it } from 'vitest';
import { canRunHere } from '@/services/agent/placement';
import type { Placement } from '@/services/agent/placement';
import { catalogue } from '@/shared/i18n/translate';

/**
 * Why a gate must not write into the panel's mirror.
 *
 * The mirror is a shallow clone the panel keeps so it can read packages, and it is
 * refreshed with `git reset --hard`. A gate that branched and wrote there looked like it
 * had worked — the console said the branch was created — while the person's own checkout
 * was untouched and the work was ten minutes from being erased.
 */
const local = (over: Partial<Placement> = {}): Placement =>
  ({
    executor: { run: async () => ({}) } as never,
    where: 'local',
    hubCwd: '/panel/.wizrelay-gate/hubs/x',
    hubMirror: true,
    ...over,
  }) as Placement;

describe('running a gate where the hub is only a mirror', () => {
  it('allows a gate that only reads the hub', () => {
    expect(canRunHere(local(), { repo: false, hub: true, hubWrites: false })).toEqual({ ok: true });
  });

  it('refuses a gate that writes to it', () => {
    expect(canRunHere(local(), { repo: false, hub: true, hubWrites: true })).toEqual({
      ok: false,
      reasonKey: 'steps.hubMirror',
    });
  });

  it('allows writing when the hub is a real checkout', () => {
    expect(
      canRunHere(local({ hubMirror: false, hubCwd: '/Users/me/Repos/hub' }), {
        repo: false,
        hub: true,
        hubWrites: true,
      }),
    ).toEqual({ ok: true });
  });

  it('allows writing on a machine the panel dispatched to', () => {
    const agent = local({ where: 'agent', hubMirror: undefined, hubCwd: '/Users/me/Repos/hub' });
    expect(canRunHere(agent, { repo: false, hub: true, hubWrites: true })).toEqual({ ok: true });
  });

  it('still reports a missing hub before it considers the mirror', () => {
    expect(
      canRunHere(local({ hubCwd: undefined }), { repo: false, hub: true, hubWrites: true }),
    ).toEqual({ ok: false, reasonKey: 'steps.noHub' });
  });

  it('explains itself in both languages', () => {
    for (const locale of ['tr', 'en'] as const) {
      expect(catalogue(locale)['steps.hubMirror'], locale).toBeTruthy();
    }
  });
});
