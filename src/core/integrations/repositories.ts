/**
 * What a repository listing means, before anything is drawn.
 *
 * Three different facts used to arrive as one empty array: no token stored, a token
 * GitHub refused, and a token that works but covers nothing. The screen read all three as
 * "GitHub is not connected" and sent people to connect a connection they already had.
 *
 * Keeping the decision here means the message and the state cannot drift apart, and the
 * cases can be checked without a browser.
 */
export interface Listing {
  connected: boolean;
  repos: unknown[];
  problem?: { status: number; message?: string };
}

export type ListingState = 'loading' | 'no-token' | 'failed' | 'empty' | 'ready';

export function listingState(listing: Listing | null, loading: boolean): ListingState {
  if (loading || listing === null) return 'loading';
  if (!listing.connected) return 'no-token';
  if (listing.problem) return 'failed';
  if (listing.repos.length === 0) return 'empty';
  return 'ready';
}

export type FailureKey =
  | 'project.repoBadToken'
  | 'project.repoNoScope'
  | 'project.repoRejected'
  | 'project.repoUnreachable';

/**
 * What GitHub's refusal means, in words somebody can act on.
 *
 * A status on its own sends people to a search engine. Each of these has one sensible
 * next step and the screen should name it; `0` is the panel never reaching GitHub at all,
 * which is a network problem and not a token problem.
 */
export function failureKey(status: number): FailureKey {
  if (status === 401) return 'project.repoBadToken';
  if (status === 403) return 'project.repoNoScope';
  if (status === 0) return 'project.repoUnreachable';
  return 'project.repoRejected';
}
