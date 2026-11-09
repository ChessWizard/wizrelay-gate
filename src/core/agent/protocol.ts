/**
 * The runner protocol: how a panel on a server gets a command run on a person's own
 * machine.
 *
 * The panel used to be the machine. `spawn` in a server action is honest when the server
 * action runs on your laptop, and wrong the moment the panel moves to a box the whole team
 * shares: that box has none of the working copies, none of the git identities and none of
 * the Claude sessions, and giving it those would mean giving one machine everybody's
 * credentials.
 *
 * So the panel stops executing and starts dispatching. Each person runs a small agent on
 * their own machine; the agent dials out to the panel, asks for work, runs it in their own
 * checkouts with their own tools, and streams the output back. The panel sees the same
 * events it always saw — which is why every gate, prompt and approval above this layer is
 * unchanged.
 *
 * Three properties are deliberate:
 *
 *   * **The agent dials out.** Nothing listens on a developer's machine and no port is
 *     opened, so this works behind NAT, a VPN or a corporate firewall.
 *   * **The allowlist is enforced where the command runs**, not only where it is planned.
 *     A panel that has been tampered with still cannot make an agent run `curl`.
 *   * **A job names a working copy the agent already declared.** The panel cannot reach
 *     outside the folders the person chose to expose.
 *
 * This module is pure: types, allowlists and the checks both sides must agree on. The
 * panel's half lives in `services/agent`, the machine's half in `public/wizrelay-agent.mjs`.
 */

/** Bumped when a change would make an older agent misbehave rather than merely miss out. */
export const AGENT_PROTOCOL_VERSION = 1;

/** The only binaries an agent will ever start. Mirrors the panel's own allowlist. */
export const AGENT_BINARIES = ['wizrelay', 'git', 'claude', 'python3'] as const;
export type AgentBinary = (typeof AGENT_BINARIES)[number];

/**
 * git is the one allowlisted binary that can reach the network and rewrite history, so its
 * first argument is allowlisted too. Everything the gate planner emits is here; anything
 * else is a command the panel never meant to send.
 */
export const AGENT_GIT_SUBCOMMANDS = [
  'add',
  'branch',
  'checkout',
  'commit',
  'config',
  'diff',
  'fetch',
  'log',
  'push',
  'rev-parse',
  'status',
  'switch',
] as const;

/** Arguments that turn an allowed git subcommand into something else entirely. */
const GIT_FORBIDDEN_ARGS = ['--upload-pack', '--receive-pack', '--exec', '-c', '--config-env'];

export type AgentJobKind = 'exec' | 'stream' | 'which' | 'read' | 'write' | 'list';

/**
 * What a file job may carry.
 *
 * The panel reads packages off its own disk, which is the right answer only when the
 * package is on its disk. On a shared panel it never is: the work happens in a person's
 * own checkout, and until it is published the panel has no way to show it — or to let
 * anybody correct a line of it. These two job kinds are that way.
 *
 * The limits are deliberately small. A package is prose: the largest file in a real one
 * is a few tens of kilobytes, and a cap that fits a document but not a database dump is
 * the difference between a feature and a way to move a disk through a job queue.
 */
export const FILE_MAX_BYTES = 512 * 1024;

/** Written files are prose. Reads allow `.json` too, because `task.json` is read. */
export const WRITABLE_SUFFIXES = ['.md'];
export const READABLE_SUFFIXES = ['.md', '.json', '.txt', '.yml', '.yaml'];

export interface AgentJobRequest {
  id: string;
  kind: AgentJobKind;
  binary: AgentBinary;
  args: string[];
  /** Absolute path on the person's machine; must sit inside a declared working copy. */
  cwd?: string;
  /** For a `read` or a `write`: the file, absolute, inside a declared working copy. */
  path?: string;
  /** For a `write`: the whole new contents. */
  body?: string;
  timeoutMs: number;
  /** What the panel will print as the command, so the agent's log and the UI agree. */
  command: string;
}

export interface AgentJobResult {
  code: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  /** Set when the agent refused or could not start the command at all. */
  error?: string;
}

export interface AgentJobChunk {
  seq: number;
  stream: 'stdout' | 'stderr';
  line: string;
}

/** One working copy the agent is willing to run in. */
export interface AgentRepoReport {
  /** The hub role this checkout plays, or `hub` for the research hub itself. */
  role: string;
  path: string;
  /** `owner/name`, when the checkout has an origin the agent could read. */
  repo?: string;
  branch?: string;
}

export interface AgentHello {
  protocol: number;
  agentVersion: string;
  hostname: string;
  platform: string;
  /** The Claude Code account this machine is signed in to, read from `~/.claude.json`. */
  claude?: { available: boolean; email?: string; name?: string };
  binaries: Partial<Record<AgentBinary, boolean>>;
  repos: AgentRepoReport[];
}

export interface AgentPairRequest {
  code: string;
  hostname: string;
  platform: string;
  agentVersion: string;
  protocol: number;
}

export interface AgentPairResponse {
  token: string;
  agentId: string;
  agentName: string;
  panelName: string;
  userName: string;
  userEmail: string;
}

/**
 * The pairing code.
 *
 * Eight characters from an alphabet with no `0/O` and no `1/I/L`, because this one is read
 * off a screen and typed into a terminal. It is single-use and short-lived; the token it
 * buys is the long-lived secret.
 */
export const PAIRING_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const PAIRING_CODE_LENGTH = 8;
export const PAIRING_TTL_MS = 10 * 60 * 1_000;

/** `WZRA-7KQ2` as it is shown; the dash is decoration and is stripped before comparing. */
export function formatPairingCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

export function normalisePairingCode(input: string): string {
  return input.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

export function isPairingCode(input: string): boolean {
  const code = normalisePairingCode(input);
  if (code.length !== PAIRING_CODE_LENGTH) return false;
  return [...code].every((character) => PAIRING_ALPHABET.includes(character));
}

/** An agent that has not said hello within this window is treated as offline. */
export const AGENT_ONLINE_MS = 90 * 1_000;

export function isAgentOnline(lastSeenAt: Date | string | null | undefined, now = Date.now()): boolean {
  if (!lastSeenAt) return false;
  const seen = typeof lastSeenAt === 'string' ? Date.parse(lastSeenAt) : lastSeenAt.getTime();
  return Number.isFinite(seen) && now - seen < AGENT_ONLINE_MS;
}

/** The role name the hub's own working copy is reported under. */
export const HUB_ROLE = 'hub';

function normalisePath(path: string): string {
  const collapsed = path.replace(/\\/g, '/').replace(/\/+/g, '/');
  return collapsed.length > 1 && collapsed.endsWith('/') ? collapsed.slice(0, -1) : collapsed;
}

/** Whether any segment of the path is `..`, which would climb out of wherever it starts. */
function climbs(path: string): boolean {
  return normalisePath(path).split('/').includes('..');
}

/**
 * Whether `candidate` is `root` or sits inside it.
 *
 * String prefixes are not enough: `/repos/app` is a prefix of `/repos/app-secrets` and
 * those are different folders. The separator has to be there.
 *
 * And a prefix is not enough either. `/repos/hub/../../.ssh/config` begins with
 * `/repos/hub/` and is not in it — this compares text, not what the filesystem would make
 * of the text, so a `..` anywhere is refused outright rather than resolved. Nothing the
 * panel legitimately sends contains one.
 */
export function isPathInside(root: string, candidate: string): boolean {
  const base = normalisePath(root);
  const target = normalisePath(candidate);
  if (!base || !target) return false;
  if (climbs(base) || climbs(target)) return false;
  if (target === base) return true;
  return target.startsWith(`${base}/`);
}

export interface JobRefusal {
  reason: 'binary' | 'git-subcommand' | 'git-argument' | 'cwd' | 'protocol' | 'file';
  detail: string;
}

/** Whether a path is one of these suffixes, compared without case. */
function hasSuffix(path: string, suffixes: readonly string[]): boolean {
  const lower = path.toLowerCase();
  return suffixes.some((suffix) => lower.endsWith(suffix));
}

/**
 * The rules a file job answers to, which the agent applies to itself.
 *
 * Same shape as the command rules and for the same reason: the panel checks before
 * sending so a bad job never leaves, and the machine checks before touching a disk so a
 * bad job never lands. Only the second one runs on hardware the person controls.
 */
export function refuseFileJob(job: AgentJobRequest, roots: string[]): JobRefusal | null {
  const path = job.path;
  if (!path) return { reason: 'file', detail: '(no path)' };
  if (path.includes('\0')) return { reason: 'file', detail: 'null byte' };

  if (!roots.some((root) => isPathInside(root, path))) {
    return { reason: 'cwd', detail: path };
  }

  // A listing names a folder, so there is no suffix to check — the folder being inside a
  // declared working copy is the whole rule.
  if (job.kind === 'list') return null;

  const allowed = job.kind === 'write' ? WRITABLE_SUFFIXES : READABLE_SUFFIXES;
  if (!hasSuffix(path, allowed)) return { reason: 'file', detail: path };

  if (job.kind === 'write') {
    const body = job.body ?? '';
    if (Buffer.byteLength(body, 'utf8') > FILE_MAX_BYTES) {
      return { reason: 'file', detail: 'too large' };
    }
  }

  return null;
}

/**
 * The check both sides run. The panel runs it before sending so a bad job never leaves,
 * and the agent runs it again before spawning so a bad job never lands — the second one is
 * the one that matters, because it is the only one the person's machine controls.
 */
export function refuseJob(job: AgentJobRequest, roots: string[]): JobRefusal | null {
  if (job.kind === 'read' || job.kind === 'write' || job.kind === 'list') {
    return refuseFileJob(job, roots);
  }

  if (!(AGENT_BINARIES as readonly string[]).includes(job.binary)) {
    return { reason: 'binary', detail: job.binary };
  }

  if (job.binary === 'git') {
    const subcommand = job.args.find((argument) => !argument.startsWith('-'));
    if (!subcommand || !(AGENT_GIT_SUBCOMMANDS as readonly string[]).includes(subcommand)) {
      return { reason: 'git-subcommand', detail: subcommand ?? '(none)' };
    }
    const bad = job.args.find((argument) =>
      GIT_FORBIDDEN_ARGS.some((forbidden) => argument === forbidden || argument.startsWith(`${forbidden}=`)),
    );
    if (bad) return { reason: 'git-argument', detail: bad };
  }

  if (job.kind !== 'which') {
    if (!job.cwd) return { reason: 'cwd', detail: '(none)' };
    if (!roots.some((root) => isPathInside(root, job.cwd as string))) {
      return { reason: 'cwd', detail: job.cwd };
    }
  }

  return null;
}

/** The command as a person would type it — what the agent logs and the console prints. */
export function describeCommand(binary: string, args: string[]): string {
  return [binary, ...args].join(' ');
}
