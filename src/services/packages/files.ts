import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import type { AcceptanceCriterion, Decision, PlanStep, TaskPackage } from '@/core/relay/types';
import {
  countPlaceholders,
  parseAcceptance,
  parseDecisions,
  parsePlan,
} from '@/core/packages/parsers';
import type { Workspace } from '@/services/workspace/types';
import { hubCachePath } from '@/services/workspace/hub-cache';
import {
  SAMPLE_CRITERIA,
  SAMPLE_DECISIONS,
  SAMPLE_PACKAGE_FILES,
  SAMPLE_PLAN,
} from '@/services/fixtures/details';

/**
 * A research package, read from disk.
 *
 * The package is a folder of Markdown in the hub, and the developer's repository holds a
 * pulled copy of it plus the files the developer owns — `plan.md`, `questions.md`,
 * `verification.md`. Both are real folders this reads; nothing here is derived or made up,
 * and a file that is not there is simply absent from the list.
 */

export interface PackageFile {
  /** Relative to the package folder: `acceptance.md`, `roles/api.md`. */
  path: string;
  owner: 'researcher' | 'developer';
  bytes: number;
  placeholders?: number;
  body: string;
  /** Which folder it came from, because the two can disagree while a pull is pending. */
  source: 'hub' | 'repo';
}

export interface PackageContents {
  files: PackageFile[];
  criteria: AcceptanceCriterion[];
  decisions: Decision[];
  plan: PlanStep[];
  task?: TaskPackage;
  /** The folders that were read, for the UI to name when something is missing. */
  hubDir?: string;
  repoDir?: string;
}

/** The files the developer owns; a pull never overwrites them. */
const DEVELOPER_FILES = ['plan.md', 'questions.md', 'verification.md', '.lock.json'];

/** Order the package the way a person reads it, not the way readdir returns it. */
const ORDER = [
  'task.json',
  'research.md',
  'scope.md',
  'acceptance.md',
  'decisions.md',
  'plan.md',
  'questions.md',
  'verification.md',
];

function rank(path: string): number {
  const index = ORDER.indexOf(path);
  if (index >= 0) return index;
  return path.startsWith('roles/') ? ORDER.length : ORDER.length + 1;
}

function ownerOf(path: string): 'researcher' | 'developer' {
  return DEVELOPER_FILES.includes(path) ? 'developer' : 'researcher';
}

/** Markdown and JSON only: a package is text, and a stray binary is not shown as one. */
function readable(path: string): boolean {
  return path.endsWith('.md') || path.endsWith('.json');
}

async function readDirectory(
  dir: string,
  source: PackageFile['source'],
  limitBytes = 400_000,
): Promise<PackageFile[]> {
  const files: PackageFile[] = [];

  const walk = async (current: string, depth: number): Promise<void> => {
    if (depth > 2) return;
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.git')) continue;
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(full, depth + 1);
        continue;
      }
      const path = relative(dir, full).split(sep).join('/');
      if (!readable(path)) continue;

      let bytes = 0;
      try {
        bytes = (await stat(full)).size;
      } catch {
        continue;
      }

      let body = '';
      if (bytes <= limitBytes) {
        try {
          body = await readFile(full, 'utf8');
        } catch {
          continue;
        }
      }

      files.push({
        path,
        owner: ownerOf(path),
        bytes,
        placeholders: countPlaceholders(body) || undefined,
        body,
        source,
      });
    }
  };

  await walk(dir, 0);
  return files;
}

async function folderFor(tasksDir: string, relayId: string): Promise<string | null> {
  try {
    const folders = await readdir(tasksDir);
    const match = folders.find((name) => name === relayId || name.startsWith(`${relayId}-`));
    return match ? join(tasksDir, match) : null;
  } catch {
    return null;
  }
}

/** Where the hub's working copy is: a path the user set, else the dashboard's own clone. */
export function hubDirectory(workspace: Workspace): string | null {
  if (!workspace.hub) return null;
  return workspace.hub.path ?? hubCachePath(workspace.hub.url);
}

/**
 * Read one relay's package.
 *
 * The hub is the source for the researcher's files; the repository adds the developer's.
 * When both hold the same file the repository's copy wins, because that is the one the
 * work was done against — and `source` records which folder answered.
 */
export async function readPackage(
  workspace: Workspace,
  relayId: string,
  role?: string,
): Promise<PackageContents> {
  if (workspace.mode === 'demo') return demoPackage(role);

  const contents: PackageContents = { files: [], criteria: [], decisions: [], plan: [] };

  const hubRoot = hubDirectory(workspace);
  const hubDir = hubRoot ? await folderFor(join(hubRoot, 'tasks'), relayId) : null;
  if (hubDir) {
    contents.hubDir = hubDir;
    contents.files.push(...(await readDirectory(hubDir, 'hub')));
  }

  const repo = role
    ? workspace.repos.find((candidate) => candidate.role === role)
    : workspace.repos[0];
  const repoDir = repo
    ? await folderFor(join(repo.path, '.wizrelay', 'tasks'), relayId)
    : null;
  if (repoDir) {
    contents.repoDir = repoDir;
    for (const file of await readDirectory(repoDir, 'repo')) {
      const existing = contents.files.findIndex((candidate) => candidate.path === file.path);
      if (existing >= 0) contents.files[existing] = file;
      else contents.files.push(file);
    }
  }

  contents.files.sort((left, right) => rank(left.path) - rank(right.path) || left.path.localeCompare(right.path));

  const bodyOf = (path: string) =>
    contents.files.find((candidate) => candidate.path === path)?.body ?? '';

  contents.criteria = parseAcceptance(bodyOf('acceptance.md'));
  contents.decisions = parseDecisions(bodyOf('decisions.md'));
  contents.plan = parsePlan(bodyOf('plan.md'));

  const task = contents.files.find((candidate) => candidate.path === 'task.json');
  if (task?.body) {
    try {
      contents.task = JSON.parse(task.body) as TaskPackage;
    } catch {
    }
  }

  return contents;
}

/** Acceptance criteria for one role; a criterion with no roles applies to all of them. */
export function criteriaForRole(
  criteria: AcceptanceCriterion[],
  role?: string,
): AcceptanceCriterion[] {
  if (!role) return criteria;
  return criteria.filter(
    (criterion) => criterion.roles.length === 0 || criterion.roles.includes(role),
  );
}

/** The bundled sample package, in the shape the real reader returns. */
function demoPackage(role?: string): PackageContents {
  const files: PackageFile[] = SAMPLE_PACKAGE_FILES.map((file) => ({
    ...file,
    source: ownerOf(file.path) === 'developer' ? 'repo' : 'hub',
  }));
  return {
    files,
    criteria: criteriaForRole(SAMPLE_CRITERIA, role),
    decisions: SAMPLE_DECISIONS,
    plan: SAMPLE_PLAN,
  };
}

/**
 * Write one file back into the package.
 *
 * The hub copy is the one that is written. The repository holds a pulled copy, and a
 * developer's half (`plan.md`, `questions.md`, `verification.md`) lives there — so the
 * folder is chosen by who owns the file rather than by which one the reader happened to
 * be looking at.
 *
 * The resolved path is checked against the folder a second time. `insidePackage` has
 * already refused everything it can see, but it reasons about a string; this reasons
 * about what the filesystem made of it, which is the only thing that can account for a
 * symlink pointing out of the folder.
 */
export async function writePackageFile(
  workspace: Workspace,
  relayId: string,
  role: string | undefined,
  file: { path: string; owner: 'researcher' | 'developer'; body: string },
): Promise<{ ok: true; bytes: number } | { ok: false; reasonKey: string }> {
  if (workspace.mode === 'demo') return { ok: false, reasonKey: 'package.write.demo' };

  const hubRoot = hubDirectory(workspace);
  const repo = role ? workspace.repos.find((candidate) => candidate.role === role) : undefined;

  const folder =
    file.owner === 'developer' && repo
      ? await folderFor(join(repo.path, '.wizrelay', 'tasks'), relayId)
      : hubRoot
        ? await folderFor(join(hubRoot, 'tasks'), relayId)
        : null;

  if (!folder) return { ok: false, reasonKey: 'package.write.noFolder' };

  const target = resolve(folder, file.path);
  const root = resolve(folder);
  if (target !== root && !target.startsWith(`${root}${sep}`)) {
    return { ok: false, reasonKey: 'package.write.outside' };
  }

  // A package file is text somebody will read as text: one trailing newline, and the
  // line endings the rest of the package uses.
  const body = `${file.body.replace(/\r\n/g, '\n').replace(/\s*$/, '')}\n`;

  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, body, 'utf8');
  return { ok: true, bytes: Buffer.byteLength(body, 'utf8') };
}

/**
 * The package as a machine holds it, when this one does not hold it at all.
 *
 * The panel's own hub copy is a mirror of the published branch. A package being written
 * lives on somebody's machine, on a branch nobody has pushed — so for everything between
 * intake and publish the panel has nothing to show, and nothing to let anybody correct.
 * It asks the machine instead.
 *
 * Only the researcher's half comes back. The developer's files live in their repository,
 * which is a separate checkout and a separate question.
 */
export async function readPackageFromMachine(
  userId: string,
  relayId: string,
): Promise<PackageContents | null> {
  const { hubOnAMachine, listOnMachine, readOnMachine } = await import('./remote');

  const hub = await hubOnAMachine(userId);
  if (!hub) return null;

  const folder = `${hub.root}/tasks`;
  const listing = await listOnMachine(hub, folder);
  if (!listing.ok) return null;

  // The folder is named after the relay and its slug, which this panel does not know
  // until it sees it.
  const prefix = listing.files
    .map((file) => file.path.split('/')[0])
    .find((name) => name === relayId || name.startsWith(`${relayId}-`));
  if (!prefix) return null;

  const mine = listing.files.filter(
    (file) => file.path === prefix || file.path.startsWith(`${prefix}/`),
  );

  const contents: PackageContents = { files: [], criteria: [], decisions: [], plan: [] };
  contents.hubDir = `${folder}/${prefix}`;

  for (const file of mine) {
    const relativePath = file.path.slice(prefix.length + 1);
    if (!relativePath || !readable(relativePath)) continue;

    const read = await readOnMachine(hub, `${folder}/${file.path}`);
    const body = read.ok ? read.body : '';
    contents.files.push({
      path: relativePath,
      owner: ownerOf(relativePath),
      bytes: file.bytes,
      placeholders: countPlaceholders(body),
      body,
      source: 'hub',
    });
  }

  contents.files.sort((left, right) => left.path.localeCompare(right.path));
  return contents.files.length > 0 ? contents : null;
}

/** Write one file into the package on the machine that holds it. */
export async function writePackageOnMachine(
  userId: string,
  relayId: string,
  file: { path: string; body: string },
): Promise<{ ok: true } | { ok: false; reasonKey: string }> {
  const { hubOnAMachine, listOnMachine, writeOnMachine } = await import('./remote');

  const hub = await hubOnAMachine(userId);
  if (!hub) return { ok: false, reasonKey: 'package.write.noMachine' };

  const folder = `${hub.root}/tasks`;
  const listing = await listOnMachine(hub, folder);
  if (!listing.ok) return { ok: false, reasonKey: 'package.write.noFolder' };

  const prefix = listing.files
    .map((entry) => entry.path.split('/')[0])
    .find((name) => name === relayId || name.startsWith(`${relayId}-`));
  if (!prefix) return { ok: false, reasonKey: 'package.write.noFolder' };

  const written = await writeOnMachine(hub, `${folder}/${prefix}/${file.path}`, file.body);
  return written.ok ? { ok: true } : { ok: false, reasonKey: 'package.write.machineRefused' };
}
