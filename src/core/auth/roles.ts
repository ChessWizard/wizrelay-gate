/** Who may do what. Pure decisions, no IO. */

export type GlobalRole = 'OWNER' | 'ADMIN' | 'MEMBER';
export type ProjectRole = 'RESEARCHER' | 'DEVELOPER';

export const GLOBAL_ROLES: GlobalRole[] = ['OWNER', 'ADMIN', 'MEMBER'];
export const PROJECT_ROLES: ProjectRole[] = ['RESEARCHER', 'DEVELOPER'];

const RANK: Record<GlobalRole, number> = { OWNER: 3, ADMIN: 2, MEMBER: 1 };

export interface Viewer {
  id: string;
  globalRole: GlobalRole;
  /** Project id to the roles held there. */
  projects: Record<string, ProjectRole[]>;
}

export function isOwner(viewer: Viewer): boolean {
  return viewer.globalRole === 'OWNER';
}

export function isAdmin(viewer: Viewer): boolean {
  return RANK[viewer.globalRole] >= RANK.ADMIN;
}

/** The global roles a viewer may hand out: their own level and below, never OWNER. */
export function assignableGlobalRoles(viewer: Viewer): GlobalRole[] {
  if (isOwner(viewer)) return ['ADMIN', 'MEMBER'];
  if (isAdmin(viewer)) return ['ADMIN', 'MEMBER'];
  return [];
}

export function canChangeGlobalRole(viewer: Viewer, target: { id: string; globalRole: GlobalRole }): boolean {
  if (target.globalRole === 'OWNER') return false;
  if (target.id === viewer.id) return false;
  return assignableGlobalRoles(viewer).length > 0;
}

export function canManageUsers(viewer: Viewer): boolean {
  return isAdmin(viewer);
}

export function canManagePanel(viewer: Viewer): boolean {
  return isOwner(viewer);
}

export function canManageHubs(viewer: Viewer): boolean {
  return isAdmin(viewer);
}

export function rolesIn(viewer: Viewer, projectId: string): ProjectRole[] {
  return viewer.projects[projectId] ?? [];
}

/** An admin reaches every project; everyone else reaches the ones they are a member of. */
export function canSeeProject(viewer: Viewer, projectId: string): boolean {
  return isAdmin(viewer) || rolesIn(viewer, projectId).length > 0;
}

export function visibleProjectIds(viewer: Viewer, all: string[]): string[] {
  return isAdmin(viewer) ? all : all.filter((id) => rolesIn(viewer, id).length > 0);
}

export function hasProjectRole(viewer: Viewer, projectId: string, role: ProjectRole): boolean {
  if (isAdmin(viewer)) return true;
  return rolesIn(viewer, projectId).includes(role);
}

/** The research track is the researcher's; the delivery track is the developer's. */
export function canRunTrack(
  viewer: Viewer,
  projectId: string,
  track: 'research' | 'delivery',
): boolean {
  return hasProjectRole(viewer, projectId, track === 'research' ? 'RESEARCHER' : 'DEVELOPER');
}

export type GateId =
  | 'intake'
  | 'research'
  | 'validate'
  | 'publish'
  | 'pull'
  | 'plan'
  | 'implement'
  | 'verify'
  | 'ship';

const RESEARCH_GATES: GateId[] = ['intake', 'research', 'validate', 'publish'];

export function canRunGate(viewer: Viewer, projectId: string, gate: GateId): boolean {
  return canRunTrack(viewer, projectId, RESEARCH_GATES.includes(gate) ? 'research' : 'delivery');
}

export function canAssignProjectRoles(viewer: Viewer): boolean {
  return isAdmin(viewer);
}

/**
 * Whether a relay is any of this viewer's business.
 *
 * A task names the hub roles it needs — `web`, `worker` — and each of those
 * is a project somebody may or may not be a member of. Membership is what access means
 * here: not seeing a task is the normal case, not a failure, and nobody needs to watch
 * every task in order to do their own.
 *
 * Owners and admins see everything, because somebody has to be able to answer "where did
 * that go" without being added to twenty projects first.
 */
export function canSeeRelay(
  viewer: Viewer,
  relayRoles: string[],
  /** The hub's roles mapped to project ids, from the hub's project list. */
  projectIdByRole: Record<string, string>,
): boolean {
  if (isAdmin(viewer)) return true;
  return relayRoles.some((role) => {
    const projectId = projectIdByRole[role];
    return Boolean(projectId) && canSeeProject(viewer, projectId);
  });
}

/**
 * Whether this viewer may read the whole panel's activity rather than their own.
 *
 * Everyone can see what they themselves did. Seeing what other people did is an
 * administrative view of the panel, not a part of doing the work.
 */
export function canSeeAllActivity(viewer: Viewer): boolean {
  return isAdmin(viewer);
}
