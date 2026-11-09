import { describe, expect, it } from 'vitest';
import { canRunHere } from '@/services/agent/placement';
import type { Placement } from '@/services/agent/placement';
import { localExecutor } from '@/services/shell/executor';

/**
 * Can this gate start, and if not, which sentence does the person read.
 *
 * The whole point of one shared answer is that the button, the console and the run never
 * disagree: a greyed-out button that says "no repository connected" while the run would
 * have said "no machine online" is how somebody spends an afternoon in the wrong screen.
 */
function placement(partial: Partial<Placement>): Placement {
  return { executor: localExecutor, where: 'local', ...partial };
}

describe('whether a gate can start', () => {
  it('runs when the checkouts a gate needs are both there', () => {
    const verdict = canRunHere(placement({ repoCwd: '/repos/api', hubCwd: '/repos/hub' }), {
      repo: true,
      hub: true,
    });
    expect(verdict.ok).toBe(true);
  });

  it('needs only what the steps of that gate ask for', () => {
    const verdict = canRunHere(placement({ hubCwd: '/repos/hub' }), { repo: false, hub: true });
    expect(verdict.ok).toBe(true);
  });

  it('blames the machine when the work was going to a machine', () => {
    const verdict = canRunHere(placement({ where: 'agent', machine: 'laptop', hubCwd: '/h' }), {
      repo: true,
      hub: false,
    });
    expect(verdict).toEqual({ ok: false, reasonKey: 'steps.noAgentRole' });
  });

  it('blames the panel when the panel was going to run it', () => {
    const verdict = canRunHere(placement({}), { repo: true, hub: false });
    expect(verdict).toEqual({ ok: false, reasonKey: 'steps.noRepo' });
  });

  it('carries a blocked placement through unchanged', () => {
    const verdict = canRunHere(placement({ blockedKey: 'steps.noAgent' }), { repo: false, hub: false });
    expect(verdict).toEqual({ ok: false, reasonKey: 'steps.noAgent' });
  });

  it('has a message for every reason it can give', async () => {
    const { catalogue } = await import('@/shared/i18n/translate');
    const keys = new Set(Object.keys(catalogue('tr')));
    for (const reason of ['steps.noAgent', 'steps.noAgentRole', 'steps.noHub', 'steps.noRepo']) {
      expect(keys.has(reason), reason).toBe(true);
    }
  });
});
