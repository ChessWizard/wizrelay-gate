import type { GateId } from '@/core/gates/gates';
import { canRunGate, canRunTrack } from '@/core/auth/roles';
import { requireUser } from '@/services/auth/context';
import { activeContext } from './active';
import type { PanelProject } from './workspace';

export interface GateGuard {
  allowed: boolean;
  reasonKey?: string;
  project: PanelProject | null;
  userId: string;
  hubId: string | null;
}

async function projectFor(role: string | undefined): Promise<PanelProject | null> {
  const context = await activeContext();
  if (!role) return context.projects[0] ?? null;
  return context.projects.find((project) => project.role === role) ?? null;
}

/** Whether the signed-in person may run this gate for this role. */
export async function guardGate(gate: GateId, role: string | undefined): Promise<GateGuard> {
  const { user, viewer } = await requireUser();
  const context = await activeContext();
  const project = await projectFor(role);

  if (!project) {
    return { allowed: false, reasonKey: 'error.forbidden', project: null, userId: user.id, hubId: context.hub?.id ?? null };
  }
  if (!canRunGate(viewer, project.id, gate)) {
    return { allowed: false, reasonKey: 'error.forbidden', project, userId: user.id, hubId: context.hub?.id ?? null };
  }
  return { allowed: true, project, userId: user.id, hubId: context.hub?.id ?? null };
}

export async function guardTrack(
  track: 'research' | 'delivery',
  role: string | undefined,
): Promise<GateGuard> {
  const { user, viewer } = await requireUser();
  const context = await activeContext();
  const project = await projectFor(role);

  if (!project) {
    return { allowed: false, reasonKey: 'error.forbidden', project: null, userId: user.id, hubId: context.hub?.id ?? null };
  }
  if (!canRunTrack(viewer, project.id, track)) {
    return { allowed: false, reasonKey: 'error.forbidden', project, userId: user.id, hubId: context.hub?.id ?? null };
  }
  return { allowed: true, project, userId: user.id, hubId: context.hub?.id ?? null };
}
