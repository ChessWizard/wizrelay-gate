import { mkdir, readFile, readdir, rename, rm, writeFile, appendFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import type { GateId } from '@/core/gates/gates';
import type { GateEvent, GateEventBody } from '@/core/relay/events';
import { streamKey } from '@/core/relay/events';
import type { Relay } from '@/core/relay/types';
import type { Workspace, WorkspacePatch } from '@/services/workspace/types';
import { DEFAULT_WORKSPACE } from '@/services/workspace/types';

/**
 * The local store: one folder on this machine, no database, no service.
 *
 * `WIZRELAY_GATE_HOME` moves it; by default it sits in `.wizrelay-gate/` beside the
 * project, which `.gitignore` already excludes. Writes are atomic (temp file + rename) so
 * an interrupted write cannot leave half a relay behind, and the event log is append-only
 * JSONL so a reconnecting console can replay from a sequence number.
 *
 * Always absolute. A relative `WIZRELAY_GATE_HOME` used to be handed straight to `git`,
 * which runs with its working directory already inside the store — so `git clone` put the
 * checkout at `.wizrelay-gate/repos/.wizrelay-gate/repos/...` and the path the panel then
 * looked in was empty.
 */
export function storeRoot(): string {
  const configured = process.env.WIZRELAY_GATE_HOME?.trim();
  return configured ? resolve(configured) : join(process.cwd(), '.wizrelay-gate');
}

async function ensureDirectory(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
}

/**
 * A counter that makes each temporary file in this process unique.
 *
 * The pid alone is not enough: several server components read the board in the same
 * request, each can save the workspace, and two writes in flight at once would pick the
 * same temporary name — the first rename moves it, the second then fails with ENOENT and
 * takes the page down with it.
 */
let writeCounter = 0;

async function writeAtomic(path: string, content: string): Promise<void> {
  await ensureDirectory(dirname(path));
  writeCounter += 1;
  const temporary = `${path}.${process.pid}.${writeCounter}.tmp`;
  try {
    await writeFile(temporary, content, 'utf8');
    await rename(temporary, path);
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => {});
    throw error;
  }
}

/**
 * Workspace writes run one after another.
 *
 * Each write is read-modify-write over one small file, so two overlapping writes can lose
 * the earlier one's change even when both renames succeed. Serialising them is enough:
 * this is one process on one machine, and the file is written only when something is
 * connected or a setting changes.
 */
let workspaceQueue: Promise<unknown> = Promise.resolve();

function queueWorkspaceWrite<T>(task: () => Promise<T>): Promise<T> {
  const next = workspaceQueue.then(task, task);
  workspaceQueue = next.catch(() => undefined);
  return next;
}

async function readJson<T>(path: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

/** The plugin's own JSON style: two spaces, no ASCII escaping, trailing newline. */
function dump(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

const workspacePath = () => join(storeRoot(), 'workspace.json');
const relayPath = (id: string) => join(storeRoot(), 'relays', `${id}.json`);
const eventsPath = (key: string) => join(storeRoot(), 'events', `${key}.jsonl`);

/**
 * The workspace the current request works in.
 *
 * On a server the panel's own records are the source: the hub the signed-in person has
 * open, and the projects they may reach. The file store is the fallback, which is what
 * keeps the engine and the tests runnable without a database.
 */
export async function getWorkspace(): Promise<Workspace> {
  try {
    const { activeContext } = await import('@/services/panel/active');
    const context = await activeContext();
    if (context.workspace) return context.workspace;
  } catch {
  }

  const stored = await readJson<Workspace>(workspacePath());
  if (!stored || stored.schema_version !== 1) return { ...DEFAULT_WORKSPACE };
  return { ...DEFAULT_WORKSPACE, ...stored };
}

export async function saveWorkspace(patch: WorkspacePatch): Promise<Workspace> {
  return queueWorkspaceWrite(async () => {
    const current = await getWorkspace();
    const next: Workspace = {
      ...current,
      ...patch,
      appearance: { ...current.appearance, ...patch.appearance },
      notifications: { ...current.notifications, ...patch.notifications },
      createdAt:
        current.createdAt === DEFAULT_WORKSPACE.createdAt
          ? new Date().toISOString()
          : current.createdAt,
      updatedAt: new Date().toISOString(),
    };
    await writeAtomic(workspacePath(), dump(next));
    return next;
  });
}

export async function resetWorkspace(): Promise<void> {
  await writeAtomic(workspacePath(), dump({ ...DEFAULT_WORKSPACE }));
}

export async function listRelays(): Promise<Relay[]> {
  const directory = join(storeRoot(), 'relays');
  let names: string[];
  try {
    names = await readdir(directory);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
  const relays: Relay[] = [];
  for (const name of names.filter((candidate) => candidate.endsWith('.json'))) {
    const relay = await readJson<Relay>(join(directory, name));
    if (relay) relays.push(relay);
  }
  return relays;
}

export async function getRelay(id: string): Promise<Relay | null> {
  return readJson<Relay>(relayPath(id));
}

export async function saveRelay(relay: Relay): Promise<Relay> {
  const next = { ...relay, updatedAt: new Date().toISOString() };
  await writeAtomic(relayPath(relay.id), dump(next));
  return next;
}

/**
 * Remove the dashboard's record of a relay, and the gate logs that belong to it.
 *
 * This never touches the hub or a project repository: a relay the hub still publishes
 * comes back on the next scan, which is why the UI only offers this for a relay that
 * exists nowhere else.
 */
export async function deleteRelay(id: string): Promise<void> {
  try {
    await rm(relayPath(id));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }

  const directory = join(storeRoot(), 'events');
  try {
    for (const name of await readdir(directory)) {
      if (name.startsWith(`${id}__`)) await rm(join(directory, name));
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}

export async function readEvents(
  relayId: string,
  role: string | undefined,
  gate: GateId,
  fromSeq = 0,
): Promise<GateEvent[]> {
  const path = eventsPath(streamKey(relayId, role, gate));
  let raw: string;
  try {
    raw = await readFile(path, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
  const events: GateEvent[] = [];
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    try {
      const event = JSON.parse(line) as GateEvent;
      if (event.seq > fromSeq) events.push(event);
    } catch {
    }
  }
  return events;
}

export async function countEvents(
  relayId: string,
  role: string | undefined,
  gate: GateId,
): Promise<number> {
  const events = await readEvents(relayId, role, gate);
  return events.length === 0 ? 0 : Math.max(...events.map((event) => event.seq));
}

export async function appendEvent(
  relayId: string,
  role: string | undefined,
  gate: GateId,
  body: GateEventBody,
  seq: number,
): Promise<GateEvent> {
  const event: GateEvent = { seq, at: new Date().toISOString(), gate, role, body };
  const path = eventsPath(streamKey(relayId, role, gate));
  await ensureDirectory(dirname(path));
  await appendFile(path, `${JSON.stringify(event)}\n`, 'utf8');
  return event;
}

export async function clearEvents(
  relayId: string,
  role: string | undefined,
  gate: GateId,
): Promise<void> {
  const path = eventsPath(streamKey(relayId, role, gate));
  await ensureDirectory(dirname(path));
  await writeFile(path, '', 'utf8');
}
