import type { Agent } from '@prisma/client';
import { HUB_ROLE, isAgentOnline } from '@/core/agent/protocol';
import type { Actor } from '@/core/identity/actor';
import { prisma } from '@/services/db/client';
import type { Executor } from '@/services/shell/executor';
import { agentExecutor, localExecutor } from '@/services/shell/executor';
import { hubIsMirror, hubWorkingCopy } from '@/services/workspace/roles';
import type { Workspace } from '@/services/workspace/types';
import { listAgents, reposOf, workingCopyOf } from './registry';

/**
 * Where this run happens, and in which folders.
 *
 * The panel has two shapes and they answer the question differently. Run on your own
 * laptop, it is the machine: the checkouts are the ones the admin registered and `spawn`
 * is honest. Run on a box the team shares, it is not: that box has no checkouts, no git
 * identity and no Claude session, and so the work belongs on the machine of whoever
 * pressed the button.
 *
 * `WIZRELAY_GATE_EXECUTION` decides which of the two this deployment is:
 *
 *   * `auto` (default) — this person's machine if one is listening, otherwise the panel's
 *     own. The single-user install keeps working untouched, and the same build on a server
 *     uses agents the moment anybody pairs one.
 *   * `agent` — never the server. What an operator sets on a shared panel so a missing
 *     agent fails loudly instead of quietly running somebody else's gate on the server.
 *   * `local` — never an agent. For a panel deliberately kept to one machine.
 */
export type ExecutionMode = 'auto' | 'local' | 'agent';

export function executionMode(): ExecutionMode {
  const raw = (process.env.WIZRELAY_GATE_EXECUTION ?? 'auto').trim().toLowerCase();
  return raw === 'local' || raw === 'agent' ? raw : 'auto';
}

export interface Placement {
  executor: Executor;
  where: 'local' | 'agent';
  /** The machine's name, when the work left the panel. */
  machine?: string;
  hubCwd?: string;
  repoCwd?: string;
  /** The hub here is the panel's read mirror, which is reset and must not be written to. */
  hubMirror?: boolean;
  /** Every checkout this machine offers, for a session that has to read the code. */
  readDirs?: string[];
  /** The working copy this gate belongs to: the repository, or the hub for research. */
  cwd?: string;
  /** Set when nothing can run: a message key, so the console says why in the user's own words. */
  blockedKey?:
    | 'steps.noAgent'
    | 'steps.noAgentRole'
    | 'steps.noHub'
    | 'steps.noRepo'
    | 'steps.hubMirror';
  /**
   * Who the run belongs to, when the work left the panel. Reading `~/.claude.json` on
   * the server would stamp every run with the operator, so the machine's own answer —
   * given when it said hello — is used instead.
   */
  actor?: Actor;
}

/**
 * The machine to send this gate to.
 *
 * An agent only qualifies if it has the working copy the gate needs, so a person with a
 * laptop that has the backend checked out and a desktop that has the frontend gets the
 * right one without choosing. When several qualify, the most recently seen wins.
 */
function pick(agents: Agent[], role: string | undefined): { agent: Agent; cwd: string } | null {
  const wanted = role ?? HUB_ROLE;
  for (const agent of agents) {
    const cwd = workingCopyOf(agent, wanted);
    if (cwd) return { agent, cwd };
  }
  return null;
}

export async function placeRun(input: {
  userId?: string | null;
  role?: string;
  workspace: Workspace;
}): Promise<Placement> {
  const mode = executionMode();
  const { role, workspace } = input;

  if (mode !== 'local' && input.userId) {
    const online = (await listAgents(input.userId)).filter((agent) => isAgentOnline(agent.lastSeenAt));
    const chosen = pick(online, role);

    if (chosen) {
      const hubCwd = workingCopyOf(chosen.agent, HUB_ROLE);
      const repoCwd = role ? workingCopyOf(chosen.agent, role) : undefined;
      const user = await prisma.user.findUnique({
        where: { id: input.userId },
        select: { name: true, email: true },
      });
      return {
        actor: {
          id: chosen.agent.claudeEmail ?? user?.email ?? chosen.agent.id,
          name: chosen.agent.claudeName ?? user?.name ?? chosen.agent.name,
          email: chosen.agent.claudeEmail ?? user?.email,
          source: chosen.agent.claudeEmail ? 'claude' : 'system',
        },
        executor: agentExecutor({
          agentId: chosen.agent.id,
          machine: chosen.agent.name,
          role,
        }),
        where: 'agent',
        machine: chosen.agent.name,
        hubCwd,
        repoCwd,
        readDirs: reposOf(chosen.agent)
          .map((entry) => entry.path)
          .filter(Boolean),
        cwd: chosen.cwd,
      };
    }

    if (mode === 'agent') {
      return {
        executor: localExecutor,
        where: 'local',
        blockedKey: online.length === 0 ? 'steps.noAgent' : 'steps.noAgentRole',
      };
    }
  }

  if (mode === 'agent') {
    return { executor: localExecutor, where: 'local', blockedKey: 'steps.noAgent' };
  }

  const hubCwd = hubWorkingCopy(workspace) ?? undefined;
  const repoCwd = role ? workspace.repos.find((repo) => repo.role === role)?.path : undefined;
  return {
    executor: localExecutor,
    where: 'local',
    hubCwd,
    hubMirror: hubIsMirror(workspace),
    repoCwd,
    readDirs: workspace.repos.map((repo) => repo.path).filter(Boolean),
    cwd: role ? repoCwd : hubCwd,
  };
}

export type BlockKey = NonNullable<Placement['blockedKey']>;

/**
 * Whether this gate can start, and the sentence that explains it when it cannot.
 *
 * A gate says which checkouts its steps need, and a placement says which ones are
 * actually reachable. Comparing the two here means the button, the console and the run all
 * refuse for the same stated reason instead of each inventing its own.
 */
export function canRunHere(
  placement: Placement,
  needs: { repo: boolean; hub: boolean; hubWrites?: boolean },
): { ok: true } | { ok: false; reasonKey: BlockKey } {
  if (placement.blockedKey) return { ok: false, reasonKey: placement.blockedKey };
  if (needs.repo && !placement.repoCwd) {
    return { ok: false, reasonKey: placement.where === 'agent' ? 'steps.noAgentRole' : 'steps.noRepo' };
  }
  if (needs.hub && !placement.hubCwd) {
    return { ok: false, reasonKey: placement.where === 'agent' ? 'steps.noAgentRole' : 'steps.noHub' };
  }
  // Reading the mirror is what it is for; writing to it is work that disappears at the
  // next refresh, and a gate that appears to succeed and then loses its output is worse
  // than one that refuses to start.
  if (needs.hubWrites && placement.hubMirror) {
    return { ok: false, reasonKey: 'steps.hubMirror' };
  }
  return { ok: true };
}

export interface HubCheckout {
  machine: string;
  path: string;
  /** The machine is the one the panel runs on, so the panel can read that folder itself. */
  sameHost: boolean;
  lastSeen: Date | null;
}

/**
 * Hub checkouts the paired machines have reported.
 *
 * Offered as suggestions when somebody is telling the panel where its own copy of the hub
 * is. The distinction that matters is whether the machine reporting a path is the machine
 * the panel runs on: a developer's path is a real folder, but on a server it is a real
 * folder the panel cannot open, and filling it in would produce a hub that reads as
 * missing with no hint as to why.
 */
export async function reportedHubCheckouts(userId: string): Promise<HubCheckout[]> {
  const { hostname } = await import('node:os');
  const here = hostname();

  const agents = await listAgents(userId);
  const out: HubCheckout[] = [];

  for (const agent of agents) {
    if (agent.revokedAt) continue;
    const path = workingCopyOf(agent, HUB_ROLE);
    if (!path) continue;
    out.push({
      machine: agent.name,
      path,
      sameHost: Boolean(agent.hostname) && agent.hostname === here,
      lastSeen: agent.lastSeenAt,
    });
  }

  return out;
}
