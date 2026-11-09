import { cache } from 'react';
import type { GateId } from '@/core/gates/gates';
import { boardMetrics, openPrompts, sortRelays, summarise, unblockRelay } from '@/core/relay/derive';
import type { BoardMetrics } from '@/core/relay/derive';
import { canSeeRelay, isAdmin } from '@/core/auth/roles';
import type { Audience, QuestionViewer } from '@/core/packages/audience';
import {
  canSeeQuestion,
  isUnrouted,
  isWaitingOn,
  questionAudience,
} from '@/core/packages/audience';
import { handleFor } from '@/core/packages/mentions';
import { prisma } from '@/services/db/client';
import { currentSession } from '@/services/auth/session';
import type { NeedsYouItem, Question, Relay, RelaySummary } from '@/core/relay/types';
import { sampleRelays } from '@/services/fixtures/relays';
import { SAMPLE_HUB, SAMPLE_REPOS } from '@/services/fixtures/sample-workspace';
import { getRelay, getWorkspace, listRelays, saveRelay, saveWorkspace } from '@/services/store/store';
import { readRepoConfig } from '@/services/workspace/connect';
import { ensureHubCopy } from '@/services/workspace/hub-cache';
import type { Workspace } from '@/services/workspace/types';
import { scanWorkspace } from './live';

/**
 * What the screens read.
 *
 * Demo mode is seeded from the fixtures once and then behaves like any other workspace:
 * answers are written, gates move, the store remembers. Live mode reads the real
 * repositories on every request — the dashboard holds no opinion the files do not.
 */
export async function ensureSeeded(): Promise<Workspace> {
  const workspace = await getWorkspace();
  if (workspace.mode !== 'demo') return workspace;
  const relays = await listRelays();
  if (relays.length > 0) return workspace;

  for (const relay of sampleRelays()) await saveRelay(relay);
  if (!workspace.hub) {
    return saveWorkspace({ hub: SAMPLE_HUB, repos: SAMPLE_REPOS });
  }
  return workspace;
}

export async function seedDemo(): Promise<void> {
  for (const relay of sampleRelays()) await saveRelay(relay);
  await saveWorkspace({ mode: 'demo', hub: SAMPLE_HUB, repos: SAMPLE_REPOS, initialized: true });
}

/** Why the hub's packages are, or are not, on this screen. */
export interface HubState {
  connected: boolean;
  /** The working copy the packages were read from. */
  path?: string;
  local?: boolean;
  fetchedAt?: string;
  error?: string;
  packages: number;
}

/**
 * Everything the board shows.
 *
 * In a live workspace the hub's packages and the dashboard's own store are two sources,
 * not one: a relay opened here (intake) exists before the hub has ever heard of it, and a
 * hub that cannot be read right now must not make those relays disappear. So the two are
 * merged — the files say where the work stands, the store says what happened here — and a
 * relay in either one is on the board.
 */
/**
 * Keep the stored repositories in step with what the plugin wrote in them.
 *
 * A role chosen in the wizard before the hub's catalogue was readable is a guess;
 * `.wizrelay/config.json` is the repository's own answer. When they disagree the file
 * wins, otherwise the delivery track for a real package would never be found.
 */
async function reconcileRepos(workspace: Workspace): Promise<Workspace> {
  if (workspace.mode !== 'live' || workspace.repos.length === 0) return workspace;

  let changed = false;
  const repos = await Promise.all(
    workspace.repos.map(async (repo) => {
      const config = await readRepoConfig(repo.path);
      const role = config?.role;
      const baseRef = config?.base_ref ?? repo.baseRef;
      if (!role) return repo;
      if (role === repo.role && baseRef === repo.baseRef) return repo;
      changed = true;
      return { ...repo, role, baseRef };
    }),
  );

  if (!changed) return workspace;
  return saveWorkspace({ repos });
}

/**
 * One read of the live workspace per request.
 *
 * The shell, the board, the readiness strip and the package list all want the same two
 * things — the hub's packages and the dashboard's own store. Before this they each
 * fetched the clone and rescanned the tree, which is where whole seconds of every page
 * render went. Now the first caller pays, and the rest share the answer.
 */
interface LiveRead {
  workspace: Workspace;
  relays: Relay[];
  hub: HubState;
}

/**
 * The relays this viewer may read.
 *
 * The hub holds every team's packages and the scan reads all of them, so without this a
 * member of one project saw — and could open — every task in the hub. Membership is what
 * access means: a relay is readable when the viewer belongs to a project whose hub role
 * the task names.
 *
 * With no session at all nothing is filtered, because there is no session on the paths
 * that have none: setup, and the local single-user install.
 */
async function readable(relays: Relay[]): Promise<Relay[]> {
  const { activeContext } = await import('@/services/panel/active');
  const context = await activeContext();
  if (!context.viewer) return relays;

  const projectIdByRole: Record<string, string> = {};
  for (const project of context.projects) projectIdByRole[project.role] = project.id;

  return relays.filter((relay) => canSeeRelay(context.viewer!, relay.roles, projectIdByRole));
}

async function readLive(): Promise<LiveRead> {
  const workspace = await reconcileRepos(await ensureSeeded());
  const stored = await listRelays();

  if (workspace.mode !== 'live' || !workspace.hub) {
    return { workspace, relays: stored, hub: { connected: false, packages: 0 } };
  }

  const reader = await currentSession().catch(() => null);
  const copy = await ensureHubCopy(workspace.hub, { userId: reader?.user.id });
  const scanned = copy.path ? await scanWorkspace(workspace, copy.path) : [];

  const byId = new Map(stored.map((relay) => [relay.id, relay]));
  const merged = scanned.map((relay) => {
    const known = byId.get(relay.id);
    byId.delete(relay.id);
    return known ? mergeRelay(relay, known) : relay;
  });

  const localOnly = [...byId.values()].map((relay) => ({ ...relay, localOnly: true }));

  // Both halves, through both rules, once.
  //
  // A relay the scan did not produce is still a relay: one this panel created whose
  // package has not reached the hub yet, or one whose hub is unreachable today. Running
  // the two halves through different code was how a local-only relay ended up skipping
  // the membership filter and keeping the `blocked` rows it was created with, while the
  // ones from the hub got both.
  const everything = [...merged, ...localOnly].map(unblockRelay);
  const allowed = await readable(everything);

  return {
    workspace,
    relays: allowed,
    hub: {
      connected: true,
      path: copy.path,
      local: copy.local,
      fetchedAt: copy.fetchedAt ?? workspace.hub.lastFetch,
      error: copy.error,
      packages: scanned.length,
    },
  };
}

const loadLive = cache(readLive);

export async function allRelays(): Promise<Relay[]> {
  return (await loadLive()).relays;
}

export async function hubState(): Promise<HubState> {
  return (await loadLive()).hub;
}

/**
 * The hub's reading of a package, and this panel's record of what it ran.
 *
 * The scan infers a gate's status from the files a package holds, which is the only thing
 * to go on for a relay this panel has never touched. For one it has, those files outlive
 * the verdicts about them: `.validation.md` is still on disk after the research it
 * validated has been rewritten, so the scan keeps reporting a validation that has been
 * withdrawn.
 *
 * So once this panel has run anything on a relay, its record of a gate *not* having run
 * is a statement rather than an absence, and it wins. For a relay it has never run, the
 * scan is still the only account there is.
 */
function panelHasRun(relay: Relay): boolean {
  return relay.tracks.some((track) => track.gates.some((gate) => Boolean(gate.startedAt)));
}

function mergeRelay(fromFiles: Relay, fromStore: Relay): Relay {
  const ours = panelHasRun(fromStore);

  return {
    ...fromFiles,
    questions: fromStore.questions.length > 0 ? fromStore.questions : fromFiles.questions,
    tracks: fromFiles.tracks.map((track) => {
      const stored = fromStore.tracks.find(
        (candidate) => candidate.id === track.id && candidate.role === track.role,
      );
      if (!stored) return track;
      return {
        ...track,
        gates: track.gates.map((gate) => {
          const storedGate = stored.gates.find((candidate) => candidate.gate === gate.gate);
          if (!storedGate) return gate;
          if (storedGate.supersededAt) return storedGate;

          const hasRunHere = storedGate.prompts.length > 0 || (storedGate.commands?.length ?? 0) > 0;
          if (hasRunHere) return { ...gate, ...storedGate };

          // Nothing to show for itself, on a relay this panel has worked: that is the
          // panel saying the gate has not run, not the panel having nothing to say.
          if (ours && !storedGate.startedAt) return storedGate;

          return gate;
        }),
      };
    }),
  };
}

export interface BoardData {
  workspace: Workspace;
  relays: RelaySummary[];
  metrics: BoardMetrics;
  needs: NeedsYouItem[];
  hub: HubState;
}

async function readBoard(): Promise<BoardData> {
  const { workspace, relays, hub } = await loadLive();
  return {
    workspace,
    relays: sortRelays(relays.map(summarise)),
    metrics: boardMetrics(relays),
    needs: relays
      .flatMap(openPrompts)
      .sort((a, b) => a.prompt.askedAt.localeCompare(b.prompt.askedAt)),
    hub,
  };
}

/**
 * One board read per request.
 *
 * The shell, the board and the readiness panel all ask for the board in the same render,
 * and each read fetches the hub and rescans the workspace. `cache` makes the second and
 * third callers share the first one's result, which also stops three of them racing to
 * write the same `lastFetch` back to the workspace file.
 */
export const loadBoard = cache(readBoard);

export async function loadRelay(id: string): Promise<Relay | null> {
  await ensureSeeded();
  const workspace = await getWorkspace();
  if (workspace.mode === 'live') {
    const relays = await allRelays();
    const found = relays.find((relay) => relay.id === id);
    if (found) return found;

    const stored = await getRelay(id);
    if (!stored) return null;
    return (await readable([unblockRelay(stored)]))[0] ?? null;
  }
  return getRelay(id);
}

export interface AskedQuestion {
  relay: Relay;
  question: Question;
  audience: Audience;
  /** This person owes it an answer, as opposed to merely being able to read it. */
  waitingOnYou: boolean;
  /** Nobody was named and the project has no research lead: it is addressed to no one. */
  unrouted: boolean;
}

/**
 * The questions this person is part of.
 *
 * Everybody used to see every question, and a list that is mostly somebody else's work is
 * a list nobody reads — the one question actually blocking a task sat in it for days.
 * What comes back now is the ones addressed to this person, the ones they asked, and, for
 * whoever administers the panel, all of them.
 *
 * A question that names nobody belongs to the project's research lead. One raised in a
 * project with no lead belongs to nobody at all, and that is reported rather than hidden,
 * because an unanswerable question is a thing somebody has to fix.
 */
export async function loadQuestions(): Promise<AskedQuestion[]> {
  const { activeContext } = await import('@/services/panel/active');
  const [relays, context, session] = await Promise.all([
    allRelays(),
    activeContext(),
    currentSession(),
  ]);

  const withQuestions = relays.filter((relay) => relay.questions.length > 0);
  if (withQuestions.length === 0) return [];

  const leadIds = [
    ...new Set(context.projects.map((project) => project.researchLeadId).filter(Boolean)),
  ] as string[];
  const leads = leadIds.length
    ? await prisma.user.findMany({
        where: { id: { in: leadIds } },
        select: { id: true, email: true },
      })
    : [];
  const emailById = new Map(leads.map((lead) => [lead.id, lead.email]));
  const leadByRole = new Map(
    context.projects.map((project) => [
      project.role,
      project.researchLeadId ? (emailById.get(project.researchLeadId) ?? null) : null,
    ]),
  );

  const viewer: QuestionViewer = {
    handle: session ? handleFor(session.user) : '',
    administers: Boolean(context.viewer && isAdmin(context.viewer)),
  };

  const asked: AskedQuestion[] = [];
  for (const relay of withQuestions) {
    for (const question of relay.questions) {
      const lead = leadByRole.get(question.role ?? '') ?? null;
      const audience = questionAudience(question, lead);
      if (!canSeeQuestion(viewer, audience)) continue;
      asked.push({
        relay,
        question,
        audience,
        waitingOnYou: isWaitingOn(viewer, audience),
        unrouted: isUnrouted(audience),
      });
    }
  }
  return asked;
}

export async function needsYouCount(): Promise<number> {
  const relays = await allRelays();
  return relays.flatMap(openPrompts).length;
}

export async function findPrompt(
  relayId: string,
  gate: GateId,
  role: string | undefined,
  promptId: string,
) {
  const relay = await loadRelay(relayId);
  if (!relay) return null;
  for (const track of relay.tracks) {
    if (track.role !== role) continue;
    for (const state of track.gates) {
      if (state.gate !== gate) continue;
      const prompt = state.prompts.find((candidate) => candidate.id === promptId);
      if (prompt) return { relay, prompt };
    }
  }
  return null;
}
