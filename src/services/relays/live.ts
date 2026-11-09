import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import type { GateId } from '@/core/gates/gates';
import type { GateStatus } from '@/core/status/status';
import type {
  GateState,
  LockFile,
  Question,
  Relay,
  TaskPackage,
  Track,
} from '@/core/relay/types';
import { parsePlan, parseQuestions, planProgress, resultOf } from '@/core/packages/parsers';
import type { RepoConnection, Workspace } from '@/services/workspace/types';

/**
 * Reading a real workspace.
 *
 * Nothing here decides anything: it reads what the plugin already wrote — the hub's
 * packages, each repository's `.wizrelay/` folder, the lock file, `plan.md`,
 * `questions.md`, `verification.md` — and turns the presence and content of those files
 * into gate states. A gate the files cannot prove stays `idle`.
 */
async function readJson<T>(path: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as T;
  } catch {
    return null;
  }
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function readText(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8');
  } catch {
    return null;
  }
}

/**
 * A gate the scan derived from the files. The result is a catalogue key rather than
 * prose: this layer has no translator, and a Turkish board must not sprout English.
 */
function gateState(
  gate: GateId,
  status: GateStatus,
  result?: { key: string; params?: Record<string, string | number> },
): GateState {
  return {
    gate,
    status,
    resultKey: result?.key,
    resultParams: result?.params,
    checks: [],
    prompts: [],
    artifacts: [],
  };
}

async function hubPackages(hubPath: string): Promise<{ folder: string; task: TaskPackage }[]> {
  const tasksDir = join(hubPath, 'tasks');
  let folders: string[];
  try {
    folders = await readdir(tasksDir);
  } catch {
    return [];
  }
  const packages: { folder: string; task: TaskPackage }[] = [];
  for (const folder of folders) {
    const task = await readJson<TaskPackage>(join(tasksDir, folder, 'task.json'));
    if (task?.id) packages.push({ folder, task });
  }
  return packages;
}

async function researchTrack(hubPath: string, folder: string, task: TaskPackage): Promise<Track> {
  const dir = join(hubPath, 'tasks', folder);
  const required = ['research.md', 'scope.md', 'acceptance.md', 'decisions.md'];
  const present = await Promise.all(required.map((name) => exists(join(dir, name))));
  const complete = present.every(Boolean);
  const validated = await exists(join(dir, '.validation.md'));
  const published = task.status === 'published';

  const gates: GateState[] = [
    gateState('intake', 'passed', { key: 'gateResult.roles', params: { count: task.roles.length } }),
    gateState(
      'research',
      complete ? 'passed' : 'running',
      complete
        ? { key: 'gateResult.filesPresent' }
        : {
            key: 'gateResult.filesPartial',
            params: { present: present.filter(Boolean).length, total: required.length },
          },
    ),
    gateState(
      'validate',
      validated ? 'passed' : complete ? 'idle' : 'blocked',
      validated ? { key: 'gateResult.validated' } : undefined,
    ),
    gateState(
      'publish',
      published ? 'passed' : validated ? 'idle' : 'blocked',
      published
        ? { key: 'gateResult.version', params: { version: task.version } }
        : { key: 'gateResult.draft' },
    ),
  ];
  return { id: 'research', gates };
}

async function deliveryTrack(
  repo: RepoConnection,
  taskId: string,
): Promise<{ track: Track; questions: Question[]; version?: number } | null> {
  const tasksDir = join(repo.path, '.wizrelay', 'tasks');
  let folders: string[];
  try {
    folders = await readdir(tasksDir);
  } catch {
    return null;
  }
  const folder = folders.find((name) => name.startsWith(taskId));
  if (!folder) return null;
  const dir = join(tasksDir, folder);

  const lock = await readJson<LockFile>(join(dir, '.lock.json'));
  const planText = await readText(join(dir, 'plan.md'));
  const questionsText = await readText(join(dir, 'questions.md'));
  const verificationText = await readText(join(dir, 'verification.md'));

  const steps = planText ? parsePlan(planText) : [];
  const progress = planProgress(steps);
  const questions = questionsText ? parseQuestions(questionsText, taskId, repo.role) : [];
  const openQuestions = questions.filter((question) => question.status === 'OPEN');

  const verdict = verificationText ? resultOf(verificationText.split('\n').slice(0, 20).join('\n')) : null;

  const gates: GateState[] = [
    gateState(
      'pull',
      lock ? 'passed' : 'idle',
      lock
        ? {
            key: 'gateResult.pulled',
            params: { version: lock.version, tier: lock.routing?.tier ?? '—' },
          }
        : undefined,
    ),
    gateState(
      'plan',
      planText ? 'passed' : lock ? 'idle' : 'blocked',
      planText ? { key: 'gateResult.steps', params: { count: progress.total } } : undefined,
    ),
    gateState(
      'implement',
      !planText
        ? 'blocked'
        : openQuestions.length > 0
          ? 'handoff'
          : progress.total > 0 && progress.done === progress.total
            ? 'passed'
            : 'running',
      planText
        ? { key: 'gateResult.stepsDone', params: { done: progress.done, total: progress.total } }
        : undefined,
    ),
    gateState(
      'verify',
      verificationText ? (verdict === 'PASS' ? 'passed' : verdict === 'FAIL' ? 'failed' : 'warned') : 'blocked',
    ),
    gateState('ship', 'blocked'),
  ];
  if (verdict) gates[3].result = verdict;
  const verifyGate = gates[3];
  if (verificationText && verdict) {
    verifyGate.verdict = verdict === 'NOT COVERED' ? 'PARTIAL' : verdict;
  }

  return {
    track: { id: 'delivery', role: repo.role, repo: repo.repo, gates },
    questions,
    version: lock?.version,
  };
}

export async function scanWorkspace(workspace: Workspace, hubPath?: string): Promise<Relay[]> {
  if (!hubPath) return [];
  const packages = await hubPackages(hubPath);
  const relays: Relay[] = [];

  for (const { folder, task } of packages) {
    const research = await researchTrack(hubPath, folder, task);
    const tracks: Track[] = [research];
    const questions: Question[] = [];
    let localVersion = task.version;

    for (const repo of workspace.repos) {
      if (!task.roles.includes(repo.role)) continue;
      const delivery = await deliveryTrack(repo, task.id);
      if (!delivery) continue;
      tracks.push(delivery.track);
      questions.push(...delivery.questions);
      if (delivery.version !== undefined) localVersion = Math.min(localVersion, delivery.version);
    }

    for (const role of task.roles) {
      if (tracks.some((track) => track.role === role)) continue;
      const connected = workspace.repos.find((repo) => repo.role === role);
      tracks.push({
        id: 'delivery',
        role,
        repo: connected?.repo ?? task.repos?.[role],
        gates: [
          gateState(
            'pull',
            'idle',
            connected
              ? { key: 'gateResult.notPulled' }
              : { key: 'gateResult.noRepo', params: { role } },
          ),
          gateState('plan', 'blocked'),
          gateState('implement', 'blocked'),
          gateState('verify', 'blocked'),
          gateState('ship', 'blocked'),
        ],
      });
    }

    relays.push({
      id: task.id,
      title: task.title,
      slug: task.slug,
      tracker: task.tracker,
      version: localVersion,
      hubVersion: task.version > localVersion ? task.version : undefined,
      packageStatus: task.status,
      roles: task.roles,
      repos: task.repos ?? {},
      enforcement: task.enforcement,
      scope: task.scope,
      routing: task.routing,
      hub: { repo: workspace.hub?.url ?? '' },
      createdAt: task.changelog?.[0]?.date ?? task.updated_at,
      updatedAt: task.updated_at,
      tracks,
      questions,
    });
  }

  return relays;
}
