import { describe, expect, it } from 'vitest';
import { invalidateAfter } from '@/core/relay/derive';
import type { GateState, Relay } from '@/core/relay/types';

/**
 * What a re-run throws away.
 *
 * A gate's verdict is about the work in front of it. Re-run research and the validation
 * that passed yesterday passed a package that no longer exists — but it went on saying
 * `passed`, so the one screen somebody checks before publishing said the package had been
 * reviewed. That is not a stale number; it is a wrong answer to the only question that
 * screen is asked.
 */
const gate = (id: string, status: string, extra: Partial<GateState> = {}): GateState =>
  ({ gate: id, status, checks: [], prompts: [], artifacts: [], ...extra }) as GateState;

const relay = (...states: GateState[]): Relay =>
  ({ tracks: [{ id: 'research', gates: states }] }) as unknown as Relay;

describe('re-running a gate', () => {
  it('clears the verdict of every gate after it', () => {
    const next = invalidateAfter(
      relay(
        gate('intake', 'passed'),
        gate('research', 'running'),
        gate('validate', 'passed', { verdict: 'PASS', result: 'clean' }),
        gate('publish', 'passed'),
      ),
      'research',
    );

    const states = next.tracks[0].gates;
    expect(states[2].status).toBe('blocked');
    expect(states[2].verdict).toBeUndefined();
    expect(states[2].result).toBeUndefined();
    expect(states[3].status).toBe('blocked');
  });

  it('leaves the gate itself and everything before it alone', () => {
    const next = invalidateAfter(
      relay(gate('intake', 'passed'), gate('research', 'running'), gate('validate', 'passed')),
      'research',
    );
    expect(next.tracks[0].gates[0].status).toBe('passed');
    expect(next.tracks[0].gates[1].status).toBe('running');
  });

  it('reaches the delivery track, which depends on publish', () => {
    const both = {
      tracks: [
        { id: 'research', gates: [gate('research', 'running'), gate('publish', 'passed')] },
        { id: 'delivery', role: 'core', gates: [gate('pull', 'passed'), gate('implement', 'passed')] },
      ],
    } as unknown as Relay;

    const next = invalidateAfter(both, 'research');
    expect(next.tracks[1].gates.map((state) => state.status)).toEqual(['blocked', 'blocked']);
  });

  it('changes nothing when there is nothing finished after it', () => {
    const before = relay(gate('research', 'running'), gate('validate', 'blocked'));
    expect(invalidateAfter(before, 'research')).toBe(before);
  });

  it('changes nothing for the last gate in the pipeline', () => {
    const before = relay(gate('ship', 'running'));
    expect(invalidateAfter(before, 'ship')).toBe(before);
  });

  it('reopens the gate that may now run again', () => {
    // Research is running, so validate is blocked — but once research passes, the normal
    // sequence has to let it through again.
    const next = invalidateAfter(
      relay(gate('intake', 'passed'), gate('research', 'passed'), gate('validate', 'passed')),
      'research',
    );
    expect(next.tracks[0].gates[2].status).toBe('idle');
  });

  it('ignores a gate it does not know', () => {
    const before = relay(gate('research', 'passed'));
    expect(invalidateAfter(before, 'nonsense' as never)).toBe(before);
  });
});

/**
 * Why the reset has to be recorded rather than merely left empty.
 *
 * The hub scan reads a gate's status from the files a package holds, and those files
 * outlive the verdict about them — `.validation.md` is still on disk after the research
 * it validated has been rewritten. A reset that only emptied the stored state looked to
 * the scan like a gate that had never run, so the scan's reading won and the verdict came
 * straight back. That is the bug this marker exists for.
 */
describe('a reset gate', () => {
  it('says when it was superseded, not merely that it is empty', () => {
    const next = invalidateAfter(
      relay(gate('research', 'running'), gate('validate', 'passed')),
      'research',
    );
    expect(next.tracks[0].gates[1].supersededAt).toBeTruthy();
  });

  it('carries nothing from the run that was withdrawn', () => {
    const next = invalidateAfter(
      relay(
        gate('research', 'running'),
        gate('validate', 'passed', {
          verdict: 'PASS',
          result: 'clean',
          commands: [{ command: 'wizrelay hub validate CU-1', exitCode: 0 }],
        }),
      ),
      'research',
    );
    const validate = next.tracks[0].gates[1];
    expect(validate.verdict).toBeUndefined();
    expect(validate.commands ?? []).toHaveLength(0);
    expect(validate.checks).toEqual([]);
  });
});
