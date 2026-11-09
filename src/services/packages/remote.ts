import { HUB_ROLE } from '@/core/agent/protocol';
import { fileOnAgent } from '@/services/agent/jobs';
import { listAgents, workingCopyOf } from '@/services/agent/registry';
import { isAgentOnline } from '@/core/agent/protocol';

export interface RemoteHub {
  agentId: string;
  machine: string;
  /** The hub checkout's path on that machine. */
  root: string;
}

/**
 * A machine that holds the hub, when this one does not.
 *
 * The panel reads packages off its own disk. On a shared panel there is no hub on that
 * disk worth reading: the mirror holds the published branch, and the work being looked at
 * is on a person's own machine, on a branch nobody has pushed. This is how the panel asks
 * that machine instead.
 *
 * The newest machine that is online and offers a hub checkout. Several people may hold
 * one; they are clones of the same repository, and the one answering now is better than
 * the one that answered last week.
 */
export async function hubOnAMachine(userId: string): Promise<RemoteHub | null> {
  const agents = await listAgents(userId);

  for (const agent of agents) {
    if (agent.revokedAt || !isAgentOnline(agent.lastSeenAt)) continue;
    const root = workingCopyOf(agent, HUB_ROLE);
    if (root) return { agentId: agent.id, machine: agent.name, root };
  }

  return null;
}

/** One file from that machine, or the reason it could not be read. */
export async function readOnMachine(
  hub: RemoteHub,
  path: string,
): Promise<{ ok: true; body: string } | { ok: false; error: string }> {
  return fileOnAgent({ agentId: hub.agentId, kind: 'read', path });
}

/** Replace one file on that machine. */
export async function writeOnMachine(
  hub: RemoteHub,
  path: string,
  body: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await fileOnAgent({ agentId: hub.agentId, kind: 'write', path, body });
  return result.ok ? { ok: true } : result;
}

export interface RemoteFile {
  path: string;
  bytes: number;
}

/**
 * Every file in a folder on that machine, with its size.
 *
 * One job for the whole folder: a package is a handful of files and a round trip each
 * would make opening a package slower than running a gate.
 */
export async function listOnMachine(
  hub: RemoteHub,
  path: string,
): Promise<{ ok: true; files: RemoteFile[] } | { ok: false; error: string }> {
  const result = await fileOnAgent({ agentId: hub.agentId, kind: 'list', path });
  if (!result.ok) return result;

  const files: RemoteFile[] = [];
  for (const line of result.body.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const row = JSON.parse(trimmed) as RemoteFile;
      if (typeof row?.path === 'string') files.push({ path: row.path, bytes: row.bytes ?? 0 });
    } catch {
      // A line this panel cannot read is one file missing from a list, not a failure.
    }
  }
  return { ok: true, files };
}
