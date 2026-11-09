import { describe, expect, it } from 'vitest';
import { GATES, GATE_IDS, isGateId, nextGate, pendingStatus } from '@/core/gates/gates';
import type { GateId } from '@/core/gates/gates';
import { isTerminal, statusRank, verdictToStatus } from '@/core/status/status';

describe('the pipeline', () => {
  it('has nine gates in order', () => {
    expect(GATE_IDS).toHaveLength(9);
    expect(GATE_IDS[0]).toBe('intake');
    expect(GATE_IDS[8]).toBe('ship');
    GATE_IDS.forEach((id, index) => expect(GATES[id].index).toBe(index + 1));
  });

  it('chains every gate to the one before it', () => {
    expect(GATES.intake.requires).toBeNull();
    for (const id of GATE_IDS.slice(1)) {
      expect(GATES[id].requires).toBe(GATE_IDS[GATE_IDS.indexOf(id) - 1]);
    }
  });

  it('knows a gate id from a string', () => {
    expect(isGateId('verify')).toBe(true);
    expect(isGateId('deploy')).toBe(false);
  });

  it('ends after ship', () => {
    expect(nextGate('verify')).toBe('ship');
    expect(nextGate('ship')).toBeNull();
  });
});

describe('a gate that has not run', () => {
  const statuses: Partial<Record<GateId, 'passed' | 'running'>> = {};
  const statusOf = (id: GateId) => statuses[id] ?? 'idle';

  it('is blocked while the gate before it is unfinished', () => {
    statuses.pull = 'running';
    expect(pendingStatus(GATES.plan, statusOf)).toBe('blocked');
  });

  it('is idle once the gate before it has passed', () => {
    statuses.pull = 'passed';
    expect(pendingStatus(GATES.plan, statusOf)).toBe('idle');
  });
});

describe('statuses', () => {
  it('sorts what needs a person first', () => {
    const order = (['passed', 'failed', 'waiting', 'idle'] as const)
      .slice()
      .sort((a, b) => statusRank(a) - statusRank(b));
    expect(order[0]).toBe('waiting');
    expect(order[1]).toBe('failed');
  });

  it('maps a verdict to a status', () => {
    expect(verdictToStatus('PASS')).toBe('passed');
    expect(verdictToStatus('PARTIAL')).toBe('warned');
    expect(verdictToStatus('FAIL')).toBe('failed');
  });

  it('counts a skipped gate as finished', () => {
    expect(isTerminal('skipped')).toBe(true);
    expect(isTerminal('waiting')).toBe(false);
  });
});
