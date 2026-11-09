/**
 * Durations and relative time. Both are rendered from an explicit `now`, never from a
 * hidden clock, so a server render and a client render of the same value agree.
 */
export type Locale = 'en' | 'tr';

export function formatDuration(ms: number | undefined, locale: Locale = 'en'): string {
  if (ms === undefined || Number.isNaN(ms)) return '—';
  const seconds = Math.max(0, Math.round(ms / 1000));
  const units =
    locale === 'tr'
      ? { d: 'g', h: 's', m: 'd', s: 'sn' }
      : { d: 'd', h: 'h', m: 'm', s: 's' };

  if (seconds < 60) return `${seconds}${units.s}`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    const rest = seconds % 60;
    return rest === 0
      ? `${minutes}${units.m}`
      : `${minutes}${units.m} ${String(rest).padStart(2, '0')}${units.s}`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    const rest = minutes % 60;
    return rest === 0 ? `${hours}${units.h}` : `${hours}${units.h} ${rest}${units.m}`;
  }
  const days = Math.floor(hours / 24);
  const rest = hours % 24;
  return rest === 0 ? `${days}${units.d}` : `${days}${units.d} ${rest}${units.h}`;
}

export function durationBetween(from?: string, to?: string): number | undefined {
  if (!from) return undefined;
  const start = new Date(from).getTime();
  const end = to ? new Date(to).getTime() : Date.now();
  if (Number.isNaN(start) || Number.isNaN(end)) return undefined;
  return Math.max(0, end - start);
}

/**
 * Relative time with `Intl.RelativeTimeFormat`, so Turkish reads "3 gün önce" without a
 * hand-written string. The absolute date goes in a `title` attribute at the call site.
 */
export function relativeTime(iso: string, locale: Locale = 'en', now = new Date()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';
  const diff = then - now.getTime();
  const absolute = Math.abs(diff);
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  const minute = 60_000;
  const hour = 3_600_000;
  const day = 86_400_000;
  const week = 7 * day;
  const month = 30 * day;

  if (absolute < minute) return formatter.format(Math.round(diff / 1000), 'second');
  if (absolute < hour) return formatter.format(Math.round(diff / minute), 'minute');
  if (absolute < day) return formatter.format(Math.round(diff / hour), 'hour');
  if (absolute < week) return formatter.format(Math.round(diff / day), 'day');
  if (absolute < month) return formatter.format(Math.round(diff / week), 'week');
  return formatter.format(Math.round(diff / month), 'month');
}

export function absoluteTime(iso: string, locale: Locale = 'en'): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export function ageInDays(iso: string, now = new Date()): number {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 0;
  return Math.max(0, Math.floor((now.getTime() - then) / 86_400_000));
}

export function nowIso(): string {
  return new Date().toISOString();
}
