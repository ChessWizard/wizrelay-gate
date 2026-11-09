import type { Viewer } from '@/core/auth/roles';
import { visibleProjectIds } from '@/core/auth/roles';
import { prisma } from '@/services/db/client';
import { hubCachePath } from '@/services/workspace/hub-cache';
import type { RepoConnection, Workspace } from '@/services/workspace/types';
import { DEFAULT_WORKSPACE } from '@/services/workspace/types';
import { getLocale } from './locale';

export interface PanelProject {
  id: string;
  hubId: string;
  role: string;
  name: string;
  repoUrl: string | null;
  localPath: string | null;
  baseRef: string;
  researchLeadId: string | null;
}

export interface PanelHub {
  id: string;
  name: string;
  url: string;
  branch: string;
  localPath: string | null;
  trackerType: string | null;
  trackerPrefix: string | null;
  fetchedAt: Date | null;
  projects: PanelProject[];
}

export async function listHubs(): Promise<PanelHub[]> {
  const hubs = await prisma.hub.findMany({
    orderBy: { createdAt: 'asc' },
    include: { projects: { orderBy: { role: 'asc' } } },
  });
  return hubs.map((hub) => ({
    id: hub.id,
    name: hub.name,
    url: hub.url,
    branch: hub.branch,
    localPath: hub.localPath,
    trackerType: hub.trackerType,
    trackerPrefix: hub.trackerPrefix,
    fetchedAt: hub.fetchedAt,
    projects: hub.projects.map((project) => ({
      id: project.id,
      hubId: project.hubId,
      role: project.role,
      name: project.name,
      repoUrl: project.repoUrl,
      localPath: project.localPath,
      baseRef: project.baseRef,
      researchLeadId: project.researchLeadId,
    })),
  }));
}

/** The hubs a viewer may open, and within each only the projects they may reach. */
export async function visibleHubs(viewer: Viewer): Promise<PanelHub[]> {
  const hubs = await listHubs();
  const allowed = new Set(
    visibleProjectIds(
      viewer,
      hubs.flatMap((hub) => hub.projects.map((project) => project.id)),
    ),
  );
  return hubs
    .map((hub) => ({ ...hub, projects: hub.projects.filter((project) => allowed.has(project.id)) }))
    .filter((hub) => hub.projects.length > 0 || viewer.globalRole !== 'MEMBER');
}

/** Remember when the panel's clone last caught up, so the next render can skip the fetch. */
export async function recordHubFetch(url: string, fetchedAt: string): Promise<void> {
  try {
    await prisma.hub.updateMany({ where: { url }, data: { fetchedAt: new Date(fetchedAt) } });
  } catch {
  }
}

export function hubPath(hub: Pick<PanelHub, 'url' | 'localPath'>): string {
  return hub.localPath ?? hubCachePath(hub.url);
}

/**
 * The shape the gate engine, scanners and routing already speak, built from the panel's
 * records for one hub and the projects the viewer may reach.
 */
export async function workspaceFor(hub: PanelHub, projects: PanelProject[]): Promise<Workspace> {
  const repos: RepoConnection[] = projects
    .filter((project) => project.localPath)
    .map((project) => ({
      id: project.id,
      path: project.localPath as string,
      role: project.role,
      repo: project.repoUrl ?? undefined,
      baseRef: project.baseRef,
    }));

  return {
    ...DEFAULT_WORKSPACE,
    mode: 'live',
    initialized: true,
    locale: await getLocale(),
    hub: {
      url: hub.url,
      path: hub.localPath ?? undefined,
      branch: hub.branch,
      name: hub.name,
      tracker: hub.trackerType ? { type: hub.trackerType, id_prefix: hub.trackerPrefix ?? undefined } : undefined,

      lastFetch: hub.fetchedAt?.toISOString(),
    },
    repos,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/** The hub the viewer is looking at, from the query string or their first one. */
export async function resolveHub(viewer: Viewer, hubId?: string): Promise<PanelHub | null> {
  const hubs = await visibleHubs(viewer);
  if (hubs.length === 0) return null;
  return hubs.find((hub) => hub.id === hubId) ?? hubs[0];
}
