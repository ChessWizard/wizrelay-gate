import { describe, expect, it } from 'vitest';

/**
 * The address people are handed.
 *
 * Two things carry it and nothing else: the invitation link, which is somebody's first
 * experience of the panel, and the pairing command, which is the only way a machine ever
 * reaches it. Built from a guess, either one is a link that goes nowhere — found by the
 * person least able to fix it.
 *
 * The rule is pure; only the header lookup is not, so that is what the test stands in
 * for.
 */
function origin(
  configured: string | undefined,
  head: Record<string, string | undefined>,
): string {
  const set = configured?.trim().replace(/\/+$/, '');
  if (set) return set;
  const host = head['x-forwarded-host'] ?? head.host ?? 'localhost:3100';
  const forwarded = head['x-forwarded-proto']?.split(',')[0]?.trim();
  const local = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host);
  return `${forwarded ?? (local ? 'http' : 'https')}://${host}`;
}

describe('the address the panel hands out', () => {
  it('is what the operator configured, trailing slash and all', () => {
    expect(origin('https://panel.company.com/', { host: 'internal:3100' })).toBe(
      'https://panel.company.com',
    );
  });

  it(`prefers the proxy headers over the request own`, () => {
    expect(
      origin(undefined, {
        host: 'gate:3100',
        'x-forwarded-host': 'panel.company.com',
        'x-forwarded-proto': 'https',
      }),
    ).toBe('https://panel.company.com');
  });

  it('takes the first scheme when a chain of proxies left several', () => {
    expect(
      origin(undefined, { host: 'panel.company.com', 'x-forwarded-proto': 'https, http' }),
    ).toBe('https://panel.company.com');
  });

  it('leaves a laptop on http, whatever the build mode', () => {
    for (const host of ['localhost:3100', '127.0.0.1:3100', '[::1]:3100']) {
      expect(origin(undefined, { host }), host).toBe(`http://${host}`);
    }
  });

  it('assumes https for a real host with no proxy headers', () => {
    expect(origin(undefined, { host: 'panel.company.com' })).toBe('https://panel.company.com');
  });

  it('still produces something when the request says nothing', () => {
    expect(origin(undefined, {})).toBe('http://localhost:3100');
  });
});
