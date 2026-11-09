import { cookies } from 'next/headers';

/**
 * Whether the side rail is showing its labels.
 *
 * It is open by default — a panel a team opens every day should say what its sections
 * are, and carry the team's own name while it is at it. The choice is a cookie so the
 * server renders the right width on the first paint and the rail never jumps.
 */
export type Rail = 'open' | 'closed';

const RAIL_COOKIE = 'wizrelay_rail';

export async function getRail(): Promise<Rail> {
  try {
    return (await cookies()).get(RAIL_COOKIE)?.value === 'closed' ? 'closed' : 'open';
  } catch {
    return 'open';
  }
}

export async function setRail(rail: Rail): Promise<void> {
  const jar = await cookies();
  jar.set(RAIL_COOKIE, rail, { sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 365 });
}
