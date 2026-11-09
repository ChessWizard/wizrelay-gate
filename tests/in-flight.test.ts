import { describe, expect, it } from 'vitest';
import { IN_FLIGHT_WINDOW_MS, hasWorkInFlight } from '@/core/relay/derive';

/**
 * What makes a screen keep refreshing itself.
 *
 * This was `isActive`, which is true for a gate waiting on a person. An unanswered
 * question two days old therefore made every open board re-scan the whole workspace every
 * four seconds — for two days — and changed nothing each time. The distinction is the
 * whole fix, so each half of it is pinned here.
 */
const NOW = Date.parse('2026-11-08T12:00:00.000Z');
const recently = new Date(NOW - 5_000).toISOString();
const ages = new Date(NOW - IN_FLIGHT_WINDOW_MS - 1_000).toISOString();

describe('whether work is in flight', () => {
  it('is true while a gate is running and the relay is still speaking', () => {
    expect(hasWorkInFlight([{ status: 'running' }], recently, NOW)).toBe(true);
  });

  it('is false when a gate is waiting for a person', () => {
    expect(hasWorkInFlight([{ status: 'waiting' }], recently, NOW)).toBe(false);
    expect(hasWorkInFlight([{ status: 'handoff' }], recently, NOW)).toBe(false);
  });

  it('stops believing a run that has said nothing for ten minutes', () => {
    expect(hasWorkInFlight([{ status: 'running' }], ages, NOW)).toBe(false);
  });

  it('is false for a relay where everything has finished', () => {
    expect(hasWorkInFlight([{ status: 'passed' }, { status: 'failed' }], recently, NOW)).toBe(false);
  });

  it('believes a run with no timestamp at all rather than hiding it', () => {
    expect(hasWorkInFlight([{ status: 'running' }], undefined, NOW)).toBe(true);
  });
});
