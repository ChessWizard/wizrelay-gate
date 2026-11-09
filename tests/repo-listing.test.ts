import { describe, expect, it } from 'vitest';
import { failureKey, listingState } from '@/core/integrations/repositories';
import { catalogue } from '@/shared/i18n/translate';

/**
 * Telling "not connected" from "connected and refused".
 *
 * The screen said GitHub was not connected whenever the list came back empty, which it
 * does for three unrelated reasons. One of them is a working connection, and being told
 * to go and fix a connection that works is worse than being told nothing.
 */
const listing = (over: Partial<Parameters<typeof listingState>[0]> = {}) => ({
  connected: true,
  repos: [],
  ...over,
});

describe('what an empty list means', () => {
  it('is loading before the answer arrives, and while it is being asked again', () => {
    expect(listingState(null, false)).toBe('loading');
    expect(listingState(listing({ repos: [1] }), true)).toBe('loading');
  });

  it('is a missing token only when no token is stored', () => {
    expect(listingState(listing({ connected: false }), false)).toBe('no-token');
  });

  it('is a failure when a token exists and GitHub refused it', () => {
    expect(listingState(listing({ problem: { status: 401 } }), false)).toBe('failed');
  });

  it('is empty when the token works and covers nothing', () => {
    expect(listingState(listing(), false)).toBe('empty');
  });

  it('is ready once there is something to pick', () => {
    expect(listingState(listing({ repos: [1, 2] }), false)).toBe('ready');
  });

  it('prefers the failure over the emptiness it caused', () => {
    // Both are true at once, and only one of them is the reason.
    expect(listingState(listing({ repos: [], problem: { status: 403 } }), false)).toBe('failed');
  });
});

describe('what a refusal is called', () => {
  it('separates an expired token from a token without the scope', () => {
    expect(failureKey(401)).toBe('project.repoBadToken');
    expect(failureKey(403)).toBe('project.repoNoScope');
  });

  it('calls a request that never left the machine a network problem', () => {
    expect(failureKey(0)).toBe('project.repoUnreachable');
  });

  it('falls back to a plain refusal for anything else', () => {
    for (const status of [404, 422, 500, 503]) {
      expect(failureKey(status)).toBe('project.repoRejected');
    }
  });

  it('has a sentence for every one of them in both languages', () => {
    for (const locale of ['tr', 'en'] as const) {
      const messages = catalogue(locale);
      for (const status of [0, 401, 403, 404, 422, 500]) {
        expect(messages[failureKey(status)], `${locale} ${status}`).toBeTruthy();
      }
    }
  });
});
