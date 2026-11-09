'use server';

import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import type { GlobalRole, ProjectRole } from '@/core/auth/roles';
import { assignableGlobalRoles, canManageHubs, canManageUsers, canManagePanel } from '@/core/auth/roles';
import { prisma } from '@/services/db/client';
import { requireAdmin, requireOwner, requireUser } from '@/services/auth/context';
import { encryptSecret } from '@/services/auth/crypto';
import { removeBrandFiles, saveBrandFile } from '@/services/panel/brand-files';
import type { BrandKind } from '@/services/panel/brand-files';
import { checkHub } from '@/services/workspace/connect';
import { parseRepoUrl } from '@/core/integrations/git-url';
import type { RepositoryListing } from '@/services/integrations/github';
import { listRepositories } from '@/services/integrations/github';
import { dropHubCache } from '@/services/workspace/hub-cache';
import { clearActiveHub, setActiveHub } from '@/services/panel/active';

export interface ActionResult {
  ok: boolean;
  errorKey?: string;
  value?: string;
}

export async function addHub(_state: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const { viewer } = await requireAdmin();
  if (!canManageHubs(viewer)) return { ok: false, errorKey: 'error.forbidden' };

  const url = String(formData.get('url') ?? '').trim();

  let check;
  try {
    check = await checkHub(url);
  } catch (error) {
    return { ok: false, errorKey: 'error.commandFailed', value: String(error) };
  }
  if (!check.ok || !check.hub) {
    return { ok: false, errorKey: 'error.commandFailed', value: check.detail };
  }

  const hub = await prisma.hub.upsert({
    where: { url: check.hub.url },
    update: {
      name: check.hub.name ?? check.hub.url,
      branch: check.hub.branch,
      localPath: check.hub.path ?? null,
      trackerType: check.hub.tracker?.type ?? null,
      trackerPrefix: check.hub.tracker?.id_prefix ?? null,
    },
    create: {
      name: check.hub.name ?? check.hub.url,
      url: check.hub.url,
      branch: check.hub.branch,
      localPath: check.hub.path ?? null,
      trackerType: check.hub.tracker?.type ?? null,
      trackerPrefix: check.hub.tracker?.id_prefix ?? null,
    },
  });

  await setActiveHub(hub.id);
  revalidatePath('/', 'layout');
  return { ok: true, value: hub.id };
}

export async function setResearchLead(projectId: string, userId: string | null): Promise<void> {
  const { viewer } = await requireAdmin();
  if (!canManageHubs(viewer)) return;
  await prisma.project.update({ where: { id: projectId }, data: { researchLeadId: userId } });
  revalidatePath('/admin');
}

export async function addPerson(
  _state: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const { viewer } = await requireAdmin();
  if (!canManageUsers(viewer)) return { ok: false, errorKey: 'error.forbidden' };

  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const name = String(formData.get('name') ?? '').trim() || email;
  const requested = String(formData.get('globalRole') ?? 'MEMBER') as GlobalRole;
  if (!email) return { ok: false, errorKey: 'auth.error.missing' };

  const allowed = assignableGlobalRoles(viewer);
  const globalRole = allowed.includes(requested) ? requested : 'MEMBER';

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { ok: false, errorKey: 'people.exists' };

  const memberships: { projectId: string; roles: ProjectRole[] }[] = [];
  const reachable = await prisma.project.findMany({ select: { id: true } });
  for (const project of reachable) {
    const roles = formData
      .getAll(`project:${project.id}`)
      .map((value) => String(value))
      .filter((value): value is ProjectRole => value === 'RESEARCHER' || value === 'DEVELOPER');
    if (roles.length > 0) memberships.push({ projectId: project.id, roles });
  }

  const inviteToken = randomBytes(24).toString('base64url');
  await prisma.user.create({
    data: {
      email,
      name,
      claudeRef: email,
      globalRole,
      inviteToken,
      inviteSentAt: new Date(),
      memberships: { create: memberships },
    },
  });

  revalidatePath('/admin');
  return { ok: true, value: inviteToken };
}

export async function setGlobalRole(userId: string, role: GlobalRole): Promise<void> {
  const { viewer } = await requireAdmin();
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target || target.globalRole === 'OWNER' || target.id === viewer.id) return;
  if (!assignableGlobalRoles(viewer).includes(role)) return;

  await prisma.user.update({ where: { id: userId }, data: { globalRole: role } });
  revalidatePath('/admin');
}

export async function setProjectRoles(
  userId: string,
  projectId: string,
  roles: ProjectRole[],
): Promise<void> {
  const { viewer } = await requireAdmin();
  if (!canManageUsers(viewer)) return;

  if (roles.length === 0) {
    await prisma.membership.deleteMany({ where: { userId, projectId } });
  } else {
    await prisma.membership.upsert({
      where: { userId_projectId: { userId, projectId } },
      update: { roles },
      create: { userId, projectId, roles },
    });
  }

  revalidatePath('/admin');
}

export async function setDisabled(userId: string, disabled: boolean): Promise<void> {
  const { viewer } = await requireAdmin();
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target || target.globalRole === 'OWNER' || target.id === viewer.id) return;

  await prisma.user.update({ where: { id: userId }, data: { disabled } });
  if (disabled) await prisma.session.deleteMany({ where: { userId } });
  revalidatePath('/admin');
}

/** What a browser will actually render, and small enough to keep beside the panel's data. */
const IMAGE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
  'image/x-icon',
  'image/vnd.microsoft.icon',
]);
const MAX_IMAGE_BYTES = 512 * 1024;

async function imageFrom(
  value: FormDataEntryValue | null,
): Promise<{ ok: true; data: Buffer; mime: string } | { ok: false; errorKey?: string }> {
  if (!(value instanceof File) || value.size === 0) return { ok: false };
  if (!IMAGE_TYPES.has(value.type)) return { ok: false, errorKey: 'setup.imageType' };
  if (value.size > MAX_IMAGE_BYTES) return { ok: false, errorKey: 'setup.imageTooBig' };
  return { ok: true, data: Buffer.from(await value.arrayBuffer()), mime: value.type };
}

/** The panel's own name. Separate from the images, which save themselves. */
export async function savePanelName(
  _state: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const { viewer } = await requireOwner();
  if (!canManagePanel(viewer)) return { ok: false, errorKey: 'error.forbidden' };

  const name = String(formData.get('name') ?? '').trim() || null;

  const description = String(formData.get('description') ?? '').trim().slice(0, 300) || null;
  await prisma.panel.upsert({
    where: { id: 'panel' },
    update: { name, description },
    create: { id: 'panel', name, description },
  });
  revalidatePath('/', 'layout');
  return { ok: true };
}

/**
 * One image, saved once the person has seen it.
 *
 * The preview happens in the browser before anything is sent, so this only ever receives
 * a picture somebody has already looked at. A file wins over a link when both arrive.
 */
export async function saveBrandImage(
  _state: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const { viewer } = await requireOwner();
  if (!canManagePanel(viewer)) return { ok: false, errorKey: 'error.forbidden' };

  const kind = String(formData.get('kind') ?? '') as BrandKind;
  if (kind !== 'logo' && kind !== 'favicon') return { ok: false, errorKey: 'auth.error.missing' };

  const column = kind === 'logo' ? 'logoFile' : 'faviconFile';
  const urlColumn = kind === 'logo' ? 'logoUrl' : 'faviconUrl';
  const data: Record<string, unknown> = {};

  const image = await imageFrom(formData.get('file'));
  if (!image.ok) return { ok: false, errorKey: image.errorKey ?? 'auth.error.missing' };

  const saved = await saveBrandFile(kind, image.data, image.mime);
  if (!saved) return { ok: false, errorKey: 'setup.imageType' };
  data[column] = saved;
  data[urlColumn] = null;

  await prisma.panel.upsert({
    where: { id: 'panel' },
    update: { ...data, brandVersion: { increment: 1 } },
    create: { id: 'panel', ...data },
  });
  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function clearBrandImage(kind: BrandKind): Promise<ActionResult> {
  const { viewer } = await requireOwner();
  if (!canManagePanel(viewer)) return { ok: false, errorKey: 'error.forbidden' };
  if (kind !== 'logo' && kind !== 'favicon') return { ok: false, errorKey: 'auth.error.missing' };

  await removeBrandFiles(kind);
  const data =
    kind === 'logo' ? { logoFile: null, logoUrl: null } : { faviconFile: null, faviconUrl: null };

  await prisma.panel.upsert({
    where: { id: 'panel' },
    update: { ...data, brandVersion: { increment: 1 } },
    create: { id: 'panel', ...data },
  });
  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function finishSetup(): Promise<void> {
  await requireOwner();
  await prisma.panel.upsert({
    where: { id: 'panel' },
    update: { initializedAt: new Date() },
    create: { id: 'panel', initializedAt: new Date() },
  });
  revalidatePath('/', 'layout');
}

export async function saveConnection(
  _state: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const { user } = await requireUser();
  const kind = String(formData.get('kind') ?? '') as 'CLAUDE' | 'GITHUB' | 'CLICKUP';
  const token = String(formData.get('token') ?? '').trim();
  const label = String(formData.get('label') ?? '').trim() || null;
  if (!kind) return { ok: false, errorKey: 'auth.error.missing' };

  await prisma.connection.upsert({
    where: { userId_kind: { userId: user.id, kind } },
    update: { secretEnc: token ? encryptSecret(token) : null, label },
    create: { userId: user.id, kind, secretEnc: token ? encryptSecret(token) : null, label },
  });
  revalidatePath('/connections');
  return { ok: true };
}

export async function removeConnection(kind: 'CLAUDE' | 'GITHUB' | 'CLICKUP'): Promise<void> {
  const { user } = await requireUser();
  await prisma.connection.deleteMany({ where: { userId: user.id, kind } });
  revalidatePath('/connections');
}

export async function switchHub(hubId: string): Promise<void> {
  await requireUser();
  await setActiveHub(hubId);
  revalidatePath('/', 'layout');
}

/**
 * Taking a hub out of the panel.
 *
 * The repository is never touched. What goes is the panel's record of it — its projects,
 * the memberships in them, and the clone the panel made for itself. A working copy the
 * operator mounted is left where it is.
 */
export async function removeHub(hubId: string): Promise<ActionResult> {
  const { viewer } = await requireAdmin();
  if (!canManageHubs(viewer)) return { ok: false, errorKey: 'error.forbidden' };

  const hub = await prisma.hub.findUnique({ where: { id: hubId } });
  if (!hub) return { ok: false, errorKey: 'hub.gone' };

  await prisma.hub.delete({ where: { id: hubId } });
  if (!hub.localPath) await dropHubCache(hub.url);

  const remaining = await prisma.hub.findFirst({ orderBy: { createdAt: 'asc' } });
  if (remaining) await setActiveHub(remaining.id);
  else await clearActiveHub();

  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function removeProject(projectId: string): Promise<ActionResult> {
  const { viewer } = await requireAdmin();
  if (!canManageHubs(viewer)) return { ok: false, errorKey: 'error.forbidden' };

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return { ok: false, errorKey: 'project.gone' };

  await prisma.project.delete({ where: { id: projectId } });
  revalidatePath('/', 'layout');
  return { ok: true };
}

/** Taking someone out of the panel. The owner's own account cannot go. */
export async function removePerson(userId: string): Promise<ActionResult> {
  const { viewer } = await requireAdmin();
  if (!canManageUsers(viewer)) return { ok: false, errorKey: 'error.forbidden' };

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return { ok: false, errorKey: 'people.gone' };
  if (target.globalRole === 'OWNER' || target.id === viewer.id) {
    return { ok: false, errorKey: 'people.cannotRemove' };
  }

  await prisma.user.delete({ where: { id: userId } });
  revalidatePath('/admin');
  return { ok: true };
}

/** A fresh one-time link, for an invitation that was lost or never arrived. */
export async function resetInvite(userId: string): Promise<ActionResult> {
  const { viewer } = await requireAdmin();
  if (!canManageUsers(viewer)) return { ok: false, errorKey: 'error.forbidden' };

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target || target.globalRole === 'OWNER') return { ok: false, errorKey: 'people.cannotRemove' };

  const inviteToken = randomBytes(24).toString('base64url');
  await prisma.user.update({
    where: { id: userId },
    data: { inviteToken, inviteSentAt: new Date(), passwordHash: null },
  });
  await prisma.session.deleteMany({ where: { userId } });
  revalidatePath('/admin');
  return { ok: true, value: inviteToken };
}

/**
 * Change what a connected hub is, without disconnecting it.
 *
 * The branch, the tracker and its prefix were fixed at the moment of connection, so a
 * team that renamed `main` to `master` could only fix it by removing the hub — and with
 * it every project, membership and piece of history hanging off it. None of these touch
 * the clone: the next fetch simply reads the branch that is named now.
 */
export async function saveHubSettings(
  _state: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const { viewer } = await requireAdmin();
  if (!canManagePanel(viewer)) return { ok: false, errorKey: 'error.forbidden' };

  const hubId = String(formData.get('hubId') ?? '');
  const hub = await prisma.hub.findUnique({ where: { id: hubId } });
  if (!hub) return { ok: false, errorKey: 'hub.none' };

  const branch = String(formData.get('branch') ?? '').trim() || hub.branch;
  const trackerType = String(formData.get('trackerType') ?? '').trim() || null;
  const trackerPrefix = String(formData.get('trackerPrefix') ?? '').trim() || null;

  // A checkout on the panel's own machine, replacing the read mirror. It has to be a
  // directory that is there: a path that is not makes every gate and every package read
  // fail later, somewhere that does not mention this field.
  const givenPath = String(formData.get('localPath') ?? '').trim();
  let localPath: string | null = hub.localPath;
  if (givenPath !== (hub.localPath ?? '')) {
    if (!givenPath) {
      localPath = null;
    } else {
      const check = await checkHub(givenPath);
      if (!check.ok) return { ok: false, errorKey: 'hub.pathBad', value: check.detail };
      localPath = check.hub?.path ?? null;
    }
  }

  await prisma.hub.update({
    where: { id: hubId },
    data: {
      branch,
      localPath,
      trackerType: trackerType === 'none' ? null : trackerType,
      trackerPrefix: trackerType === 'none' ? null : trackerPrefix,

      fetchedAt: branch === hub.branch ? hub.fetchedAt : null,
    },
  });

  revalidatePath('/admin');
  revalidatePath('/settings');
  revalidatePath('/');
  return { ok: true };
}

/**
 * Register a project by what it is, not by where a copy of it sits.
 *
 * On a panel that dispatches to agents there is no useful local path: the gate runs on
 * the person's own machine and their agent reports the checkout it will use. A clone on
 * the server would be a directory nobody works in, taking space and giving the false
 * comfort of a "connected" repository.
 *
 * So this records the role and the address. Which machine holds a copy, and where, is a
 * question each agent answers for itself.
 */
export async function addProjectByUrl(
  _state: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const { viewer } = await requireAdmin();
  // Giving a hub role a repository is a hub operation, like adding or removing one. It
  // was the only one of them an admin could not do.
  if (!canManageHubs(viewer)) return { ok: false, errorKey: 'error.forbidden' };

  const hubId = String(formData.get('hubId') ?? '');
  const role = String(formData.get('role') ?? '').trim();
  const repoUrl = String(formData.get('repoUrl') ?? '').trim();
  if (!hubId || !role || !repoUrl) return { ok: false, errorKey: 'auth.error.missing' };

  const hub = await prisma.hub.findUnique({ where: { id: hubId } });
  if (!hub) return { ok: false, errorKey: 'hub.none' };

  // A typed address goes through the same reading as a picked one, so a typo becomes a
  // refusal here rather than a project pointing at nothing.
  const ref = parseRepoUrl(repoUrl);
  if (!ref) return { ok: false, errorKey: 'project.badUrl' };
  const name = `${ref.owner}/${ref.repo}`;
  await prisma.project.upsert({
    where: { hubId_role: { hubId, role } },
    update: { name, repoUrl },
    create: { hubId, role, name, repoUrl },
  });

  revalidatePath('/admin');
  revalidatePath('/');
  return { ok: true };
}

/**
 * The repositories the signed-in person's GitHub token can see.
 *
 * Asked for by the form rather than rendered into the page: the call is a round trip to
 * GitHub, and holding the administration screen while it happens would make every visit
 * to that page as slow as the slowest token.
 *
 * It answers with why, not just what. The form used to receive a bare list and read an
 * empty one as "no token", so somebody with a working connection was told to go and
 * connect it.
 */
export async function githubRepositories(): Promise<RepositoryListing> {
  const { user, viewer } = await requireAdmin();
  if (!canManageHubs(viewer)) {
    return { connected: false, repos: [], problem: { status: 403, message: 'forbidden' } };
  }
  try {
    return await listRepositories(user.id);
  } catch (error) {
    return {
      connected: true,
      repos: [],
      problem: { status: 0, message: error instanceof Error ? error.message : undefined },
    };
  }
}
