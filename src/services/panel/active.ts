import { cache } from 'react';
import { cookies } from 'next/headers';
import type { Viewer } from '@/core/auth/roles';
import { prisma } from '@/services/db/client';
import { currentSession } from '@/services/auth/session';
import type { Workspace } from '@/services/workspace/types';
import type { PanelHub, PanelProject } from './workspace';
import { resolveHub, visibleHubs, workspaceFor } from './workspace';

const HUB_COOKIE = 'wizrelay_hub';

export interface ActiveContext {
  viewer: Viewer | null;
  hub: PanelHub | null;
  projects: PanelProject[];
  hubs: PanelHub[];
  workspace: Workspace | null;
}

async function selectedHubId(): Promise<string | undefined> {
  try {
    return (await cookies()).get(HUB_COOKIE)?.value;
  } catch {
    return undefined;
  }
}

async function read(): Promise<ActiveContext> {
  const empty: ActiveContext = { viewer: null, hub: null, projects: [], hubs: [], workspace: null };

  let session;
  try {
    session = await currentSession();
  } catch {
    return empty;
  }
  if (!session) return empty;

  const hubs = await visibleHubs(session.viewer);
  const hub = await resolveHub(session.viewer, await selectedHubId());
  if (!hub) return { ...empty, viewer: session.viewer, hubs };

  return {
    viewer: session.viewer,
    hub,
    hubs,
    projects: hub.projects,
    workspace: await workspaceFor(hub, hub.projects),
  };
}

/** One resolution per request, shared by every component that asks. */
export const activeContext = cache(read);

export async function setActiveHub(hubId: string): Promise<void> {
  const jar = await cookies();
  jar.set(HUB_COOKIE, hubId, { httpOnly: true, sameSite: 'lax', path: '/' });
}

export async function clearActiveHub(): Promise<void> {
  const jar = await cookies();
  jar.delete(HUB_COOKIE);
}

export async function hasAnyHub(): Promise<boolean> {
  try {
    return (await prisma.hub.count()) > 0;
  } catch {
    return false;
  }
}
