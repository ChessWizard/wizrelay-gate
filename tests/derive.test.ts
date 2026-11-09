import { describe, expect, it } from 'vitest';
import {
  boardMetrics,
  currentGate,
  findGateState,
  openPrompts,
  relayStatus,
  sortRelays,
  summarise,
} from '@/core/relay/derive';
import type { Relay } from '@/core/relay/types';
import { sampleRelays } from '@/services/fixtures/relays';

const relays = sampleRelays();
const quota = relays.find((relay) => relay.id === 'CU-86c1abcd') as Relay;

describe('the sample workspace', () => {
  it('has seven relays and no duplicate gate in a track', () => {
    expect(relays).toHaveLength(7);
    for (const relay of relays) {
      for (const track of relay.tracks) {
        const ids = track.gates.map((gate) => gate.gate);
        expect(new Set(ids).size, `${relay.id} ${track.role ?? 'hub'}`).toBe(ids.length);
      }
    }
  });
});

describe('a relay', () => {
  it('reports the status that needs a person', () => {
    expect(relayStatus(quota)).toBe('waiting');
  });

  it('points at the gate that is waiting', () => {
    expect(currentGate(quota)).toBe('implement');
  });

  it('finds a gate by role', () => {
    expect(findGateState(quota, 'plan', 'frontend')?.state.status).toBe('running');
    expect(findGateState(quota, 'plan', 'backend')?.state.status).toBe('passed');
  });

  it('lists its open prompts with the gate they belong to', () => {
    const prompts = openPrompts(quota);
    expect(prompts).toHaveLength(1);
    expect(prompts[0].gate).toBe('implement');
    expect(prompts[0].role).toBe('backend');
  });

  it('summarises into one research track and one row per role', () => {
    const summary = summarise(quota);
    expect(summary.research).toHaveLength(4);
    expect(summary.byRole.map((role) => role.role)).toEqual(['backend', 'frontend']);
    expect(summary.byRole[0].gates).toHaveLength(5);
  });
});

describe('the board', () => {
  it('sorts what waits for a person above everything else', () => {
    const sorted = sortRelays(relays.map(summarise));
    expect(sorted[0].status).toBe('waiting');
    expect(sorted[sorted.length - 1].status).not.toBe('waiting');
  });

  it('counts only what it can compute', () => {
    const metrics = boardMetrics(relays);
    expect(metrics.needsYou).toBe(2);
    expect(metrics.openQuestions).toBe(2);
    expect(metrics.verdicts).toEqual({ pass: 3, partial: 1, fail: 1 });
    expect(metrics.scopeViolations).toBe(2);
    expect(metrics.medianWaitMs).toBeGreaterThan(0);
  });
});
