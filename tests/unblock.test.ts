import { describe, expect, it } from 'vitest';
import { syncBlocked, unblockRelay } from '@/core/relay/derive';
import type { GateState, Relay } from '@/core/relay/types';

/**
 * Letting the next gate run once the one before it has finished.
 *
 * A relay is created with every gate after the first written as `blocked`, and nothing
 * recomputed those rows afterwards: intake passed and research went on saying it was
 * blocked until intake passed. The sequence was being stored as a fact instead of
 * derived from one.
 */
const RESEARCH = ['intake', 'research', 'validate', 'publish'] as const;

const gate = (id: string, status: string): GateState =>
  ({ gate: id, status, checks: [], prompts: [], artifacts: [] }) as GateState;

const states = (...pairs: [string, string][]) => pairs.map(([id, status]) => gate(id, status));

describe('reopening a gate whose requirement is met', () => {
  it('opens the next gate when the one before it passed', () => {
    const next = syncBlocked(
      states(['intake', 'passed'], ['research', 'blocked'], ['validate', 'blocked']),
      RESEARCH,
    );
    expect(next.map((state) => state.status)).toEqual(['passed', 'idle', 'blocked']);
  });

  it('opens it for a warning or a skip, which are also finished', () => {
    for (const verdict of ['warned', 'skipped']) {
      const next = syncBlocked(states(['intake', verdict], ['research', 'blocked']), RESEARCH);
      expect(next[1].status, verdict).toBe('idle');
    }
  });

  it('keeps it closed while the one before it failed or is waiting', () => {
    for (const verdict of ['failed', 'waiting', 'running', 'blocked']) {
      const next = syncBlocked(states(['intake', verdict], ['research', 'blocked']), RESEARCH);
      expect(next[1].status, verdict).toBe('blocked');
    }
  });

  it('closes a gate that was open when its requirement was undone', () => {
    const next = syncBlocked(states(['intake', 'failed'], ['research', 'idle']), RESEARCH);
    expect(next[1].status).toBe('blocked');
  });

  it('never touches a gate that has already run', () => {
    // A verdict is a fact about something that happened, not a position in a sequence.
    const next = syncBlocked(states(['intake', 'failed'], ['research', 'passed']), RESEARCH);
    expect(next[1].status).toBe('passed');
  });

  it('leaves the first gate alone, since it requires nothing', () => {
    expect(syncBlocked(states(['intake', 'blocked']), RESEARCH)[0].status).toBe('idle');
  });

  it('returns the same objects when nothing changed, so renders do not churn', () => {
    const before = states(['intake', 'passed'], ['research', 'idle']);
    const after = syncBlocked(before, RESEARCH);
    expect(after[0]).toBe(before[0]);
    expect(after[1]).toBe(before[1]);
  });
});

describe('a whole relay', () => {
  it('reopens every track it has', () => {
    const relay = {
      tracks: [
        { id: 'research', gates: states(['intake', 'passed'], ['research', 'blocked']) },
        { id: 'delivery', role: 'core', gates: states(['pull', 'passed'], ['plan', 'blocked']) },
      ],
    } as unknown as Relay;

    const next = unblockRelay(relay);
    expect(next.tracks[0].gates[1].status).toBe('idle');
    expect(next.tracks[1].gates[1].status).toBe('idle');
  });
});
