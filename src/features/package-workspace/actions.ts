'use server';

import { revalidatePath } from 'next/cache';
import { mayWrite } from '@/core/packages/writable';
import { editOneFile } from '@/core/gates/prompts';
import { localeFor } from '@/services/panel/locale';
import type { Owner } from '@/core/packages/writable';
import { rolesIn, isAdmin } from '@/core/auth/roles';
import { requireUser } from '@/services/auth/context';
import { activeContext } from '@/services/panel/active';
import {
  readPackage,
  readPackageFromMachine,
  writePackageFile,
  writePackageOnMachine,
} from '@/services/packages/files';
import { startGate } from '@/services/engine/runner';
import { record } from '@/services/panel/activity';
import { getWorkspace } from '@/services/store/store';

export interface SaveResult {
  ok: boolean;
  errorKey?: string;
}

/**
 * Which halves of a package this person may write.
 *
 * Their project roles, with one addition: somebody who administers the panel acts as
 * both, because an admin already reaches every project and a package they can open but
 * not correct is a worse answer than one they can.
 */
async function actsAs(role: string | undefined): Promise<Owner[]> {
  const { viewer } = await requireUser();
  if (isAdmin(viewer)) return ['researcher', 'developer'];

  const context = await activeContext();
  const project = context.projects.find((candidate) => candidate.role === role);
  if (!project) return [];

  return rolesIn(viewer, project.id).map((entry) =>
    entry === 'RESEARCHER' ? 'researcher' : 'developer',
  );
}

/**
 * Save one package file.
 *
 * The file's owner is read from the package rather than taken from the form: owner
 * decides which folder is written and whether this person may write it at all, and a
 * value the browser supplies decides neither.
 */
export async function savePackageFile(input: {
  relayId: string;
  role?: string;
  path: string;
  body: string;
}): Promise<SaveResult> {
  const { user } = await requireUser();
  const workspace = await getWorkspace();

  const local = await readPackage(workspace, input.relayId, input.role);
  const remote =
    local.files.length === 0 ? await readPackageFromMachine(user.id, input.relayId) : null;
  const contents = remote ?? local;

  const file = contents.files.find((candidate) => candidate.path === input.path);
  if (!file) return { ok: false, errorKey: 'package.write.outside' };

  const verdict = mayWrite(file.path, file.owner, await actsAs(input.role));
  if (!verdict.ok) return { ok: false, errorKey: verdict.reasonKey };

  // Written where it was read. Writing the panel's mirror instead would put the edit
  // somewhere the next cache refresh erases, and leave the file the person was looking at
  // untouched.
  const written = remote
    ? await writePackageOnMachine(user.id, input.relayId, { path: file.path, body: input.body })
    : await writePackageFile(workspace, input.relayId, input.role, {
        path: file.path,
        owner: file.owner,
        body: input.body,
      });
  if (!written.ok) return { ok: false, errorKey: written.reasonKey };

  await record({
    kind: 'PACKAGE_PUBLISHED',
    userId: user.id,
    relayId: input.relayId,
    summary: `${file.path} · ${Buffer.byteLength(input.body, "utf8")} B`,
  }).catch(() => undefined);

  revalidatePath(`/package/${input.relayId}`);
  revalidatePath(`/relay/${input.relayId}`);
  return { ok: true };
}

/**
 * Hand one file to Claude with an instruction.
 *
 * It starts the research gate rather than opening a second kind of session, so the work
 * arrives in the console everybody already watches, under the scope protection and the
 * approvals every other gate runs under. The instruction names the file, because a gate
 * told to "add a verification command" with no subject rewrites the whole package.
 */
export async function editWithClaude(input: {
  relayId: string;
  role?: string;
  path: string;
  instruction: string;
}): Promise<SaveResult> {
  const { user } = await requireUser();
  const instruction = input.instruction.trim();
  if (!instruction) return { ok: false, errorKey: 'auth.error.missing' };

  const workspace = await getWorkspace();
  const local = await readPackage(workspace, input.relayId, input.role);
  const contents =
    local.files.length === 0
      ? ((await readPackageFromMachine(user.id, input.relayId)) ?? local)
      : local;

  const file = contents.files.find((candidate) => candidate.path === input.path);
  if (!file) return { ok: false, errorKey: 'package.write.outside' };

  const verdict = mayWrite(file.path, file.owner, await actsAs(input.role));
  if (!verdict.ok) return { ok: false, errorKey: verdict.reasonKey };

  const result = await startGate({
    relayId: input.relayId,
    role: input.role,
    gate: 'research',
    userId: user.id,
    notes: editOneFile(file.path, instruction, await localeFor(user.id)),
  });

  if (!result.started) return { ok: false, errorKey: result.reason ?? 'error.commandFailed' };

  revalidatePath(`/relay/${input.relayId}`);
  return { ok: true };
}
