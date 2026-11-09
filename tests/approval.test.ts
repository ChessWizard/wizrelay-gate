import { describe, expect, it } from 'vitest';
import { ALWAYS_ASK, preApproved } from '@/services/engine/approval';

/**
 * Which outward-facing steps run without stopping to ask.
 *
 * The default matters more than the feature: a panel that stops asking by accident is
 * worse than one that never offered to stop, because the person finds out from the git
 * history. So the empty case is pinned here, and every kind is checked separately —
 * somebody who allowed commits has not allowed pushes.
 */
describe('what runs without asking', () => {
  it('asks about everything by default', () => {
    expect(preApproved(ALWAYS_ASK, 'commit')).toBe(false);
    expect(preApproved(ALWAYS_ASK, 'push')).toBe(false);
  });

  it('keeps commits and pushes apart', () => {
    const commitsOnly = { commits: true, pushes: false };
    expect(preApproved(commitsOnly, 'commit')).toBe(true);
    expect(preApproved(commitsOnly, 'push')).toBe(false);

    const pushesOnly = { commits: false, pushes: true };
    expect(preApproved(pushesOnly, 'commit')).toBe(false);
    expect(preApproved(pushesOnly, 'push')).toBe(true);
  });

  it('never pre-approves a step that is not outward-facing', () => {
    expect(preApproved({ commits: true, pushes: true }, null)).toBe(false);
  });
});
