import { describe, expect, it } from 'vitest';
import { ageInDays, durationBetween, formatDuration, relativeTime } from '@/core/time/format';

describe('durations', () => {
  it('reads in seconds, minutes, hours and days', () => {
    expect(formatDuration(8_000)).toBe('8s');
    expect(formatDuration(252_000)).toBe('4m 12s');
    expect(formatDuration(5_400_000)).toBe('1h 30m');
    expect(formatDuration(259_200_000)).toBe('3d');
  });

  it('uses Turkish units', () => {
    expect(formatDuration(8_000, 'tr')).toBe('8sn');
    expect(formatDuration(252_000, 'tr')).toBe('4d 12sn');
    expect(formatDuration(259_200_000, 'tr')).toBe('3g');
  });

  it('says nothing rather than zero when there is nothing to say', () => {
    expect(formatDuration(undefined)).toBe('—');
  });

  it('measures between two timestamps', () => {
    expect(durationBetween('2026-11-06T10:00:00Z', '2026-11-06T10:01:00Z')).toBe(60_000);
    expect(durationBetween(undefined)).toBeUndefined();
  });
});

describe('relative time', () => {
  const now = new Date('2026-11-06T12:00:00Z');

  it('reads in the locale', () => {
    expect(relativeTime('2026-11-06T11:46:00Z', 'en', now)).toContain('14');
    expect(relativeTime('2026-11-03T12:00:00Z', 'tr', now)).toContain('gün');
  });

  it('counts whole days for the age of a question', () => {
    expect(ageInDays('2026-11-03T12:00:00Z', now)).toBe(3);
  });
});
