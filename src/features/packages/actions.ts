'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { GATE_IDS, GATES } from '@/core/gates/gates';
import type { GateId } from '@/core/gates/gates';
import type { GateState, Relay, Track } from '@/core/relay/types';
import { getWorkspace, saveRelay } from '@/services/store/store';
import { requireUser } from '@/services/auth/context';
import { startGate } from '@/services/engine/runner';

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

function emptyGates(ids: readonly GateId[], firstIdle: boolean): GateState[] {
  return ids.map((id, index) => ({
    gate: id,
    status: index === 0 && firstIdle ? 'idle' : 'blocked',
    checks: [],
    prompts: [],
    artifacts: [],
  }));
}

/**
 * Intake: a tracker reference becomes a relay.
 *
 * The identifier is normalised the way the plugin does it — the tracker's prefix plus the
 * raw reference — and nothing is published: the package starts as a draft, which is what
 * `wizrelay hub new` produces.
 */
export async function createRelay(formData: FormData): Promise<void> {
  const { user } = await requireUser();
  const reference = String(formData.get('reference') ?? '').trim();
  const title = String(formData.get('title') ?? '').trim();

  const roles = formData
    .getAll('roles')
    .flatMap((value) => String(value).split(','))
    .map((role) => role.trim())
    .filter(Boolean);

  if (!reference || !title || roles.length === 0) return;

  const workspace = await getWorkspace();
  const prefix = workspace.hub?.tracker?.id_prefix ?? '';
  const id = reference.startsWith(prefix) ? reference : `${prefix}${reference}`;
  const now = new Date().toISOString();

  const research: Track = {
    id: 'research',
    gates: emptyGates(['intake', 'research', 'validate', 'publish'], true),
  };
  const delivery: Track[] = roles.map((role) => ({
    id: 'delivery',
    role,
    repo: workspace.repos.find((candidate) => candidate.role === role)?.repo,
    gates: emptyGates(
      GATE_IDS.filter((gate) => GATES[gate].track === 'delivery'),
      false,
    ),
  }));

  const relay: Relay = {
    id,
    title,
    slug: slugify(title),
    tracker: {
      type: workspace.hub?.tracker?.type ?? 'none',
      ref: reference,
      url:
        workspace.hub?.tracker?.type === 'clickup'
          ? `https://app.clickup.com/t/${reference}`
          : undefined,
    },
    version: 0,
    packageStatus: 'draft',
    roles,
    repos: Object.fromEntries(
      delivery.filter((track) => track.repo).map((track) => [track.role ?? '', track.repo ?? '']),
    ),
    enforcement: 'strict',
    scope: Object.fromEntries(roles.map((role) => [role, { allow: [], deny: [] }])),
    hub: { repo: workspace.hub?.url ?? '' },
    createdAt: now,
    updatedAt: now,
    tracks: [research, ...delivery],
    questions: [],
  };

  await saveRelay(relay);
  await startGate({ relayId: id, gate: 'intake', userId: user.id });
  revalidatePath('/');
  revalidatePath('/relays');
  redirect(`/relay/${encodeURIComponent(id)}?gate=intake`);
}
