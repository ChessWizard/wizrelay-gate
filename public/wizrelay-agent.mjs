#!/usr/bin/env node
/**
 * wizrelay-gate agent — the half of the panel that runs on your own machine.
 *
 * The panel can live on a box the whole team reaches. That box has none of your
 * checkouts, none of your git identity and no Claude session, and giving it those would
 * mean handing one server everybody's credentials. So it does not run anything: it asks.
 *
 * This process dials out to the panel, waits for a command addressed to your machine,
 * runs it in one of the folders you listed, and sends the output back. Nothing listens
 * here and no port is opened, so it works from a laptop behind NAT, a VPN or a corporate
 * firewall.
 *
 * It will only ever start `wizrelay`, `git`, `claude` or `python3`, only inside a folder
 * you added yourself, and it prints every command before it runs it. The allowlist is
 * enforced here, not only on the panel — a panel somebody has tampered with still cannot
 * make this machine run `curl`.
 *
 * No dependencies: Node 18 or newer, and nothing else.
 *
 *   wizrelay-agent pair ABCD-2345 --panel https://panel.example.com
 *   wizrelay-agent add ~/Repos/api-service            # role from .wizrelay/config.json
 *   wizrelay-agent add ~/Repos/research-hub --role hub
 *   wizrelay-agent run
 *
 * The protocol is defined in src/core/agent/protocol.ts; the allowlists below are kept in
 * step with it by tests/agent-protocol.test.ts, which fails if the two ever drift.
 */

import { spawn } from 'node:child_process';
import { constants } from 'node:fs';
import { access, chmod, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { homedir, hostname, platform } from 'node:os';
import { delimiter, dirname, join, relative, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const AGENT_VERSION = '1.4.0';
const PROTOCOL = 1;

const BINARIES = ['wizrelay', 'git', 'claude', 'python3'];
const GIT_SUBCOMMANDS = [
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
];
const GIT_FORBIDDEN_ARGS = ['--upload-pack', '--receive-pack', '--exec', '-c', '--config-env'];

/* A package is prose. A cap that fits a document and not a database dump is the
   difference between a feature and a way to move a disk through a job queue. */
const FILE_MAX_BYTES = 512 * 1024;
const WRITABLE_SUFFIXES = ['.md'];
const READABLE_SUFFIXES = ['.md', '.json', '.txt', '.yml', '.yaml'];

/**
 * Variables Claude Code exports into everything it starts.
 *
 * An agent launched from inside a Claude Code session inherits them, and then every child
 * it spawns looks like part of *that* session: `wizrelay` reports WIZRELAY_NO_GUARD
 * because the session id it sees never wrote a heartbeat, and `claude -p` starts inside
 * somebody else's conversation. A gate's session has to be its own.
 */
const PARENT_SESSION_VARS = [
  'CLAUDECODE',
  'CLAUDE_CODE_ENTRYPOINT',
  'CLAUDE_CODE_SSE_PORT',
  'CLAUDE_CODE_SESSION_ID',
  'CLAUDE_SESSION_ID',
  'CLAUDE_AGENT_SDK_VERSION',
  'CLAUDE_CODE_DESKTOP_APP_VERSION',
  'CLAUDE_CODE_OAUTH_SCOPES',
  'CLAUDE_CODE_SIMPLE',
  'CLAUDE_CODE_EMIT_TOOL_USE_SUMMARIES',
  'CLAUDE_CODE_ENABLE_ASK_USER_QUESTION_TOOL',
  'CLAUDE_CODE_DISABLE_TERMINAL_TITLE',
];

function childEnv() {
  const env = { ...process.env };
  for (const name of PARENT_SESSION_VARS) delete env[name];
  return env;
}

const CONFIG_DIR = join(homedir(), '.wizrelay-gate');
const CONFIG_PATH = join(CONFIG_DIR, 'agent.json');
const INSTALL_PATH = join(CONFIG_DIR, 'wizrelay-agent.mjs');
const LOCK_PATH = join(CONFIG_DIR, 'agent.pid');

const HELLO_EVERY_MS = 30_000;
const POLL_WAIT_MS = 25_000;
/** How long a token waits before it is sent. Short enough to read as typing. */
const STREAM_FLUSH_MS = 120;
/**
 * The longest single line kept whole.
 *
 * These lines are JSON objects, so a truncated one is not a shortened line but a broken
 * one that the panel drops entirely. Claude Code's `init` event alone measures about
 * 14 kB — it lists every tool and plugin — so an 8 kB cut silently removed the event that
 * says the session is ready.
 */
const MAX_LINE = 64_000;
const RETRY_MIN_MS = 2_000;
const RETRY_MAX_MS = 60_000;

/* ------------------------------------------------------------------ output */

const COLOUR = process.stdout.isTTY && !process.env.NO_COLOR;
const dim = (text) => (COLOUR ? `\u001b[2m${text}\u001b[0m` : text);
const bold = (text) => (COLOUR ? `\u001b[1m${text}\u001b[0m` : text);
const red = (text) => (COLOUR ? `\u001b[31m${text}\u001b[0m` : text);
const green = (text) => (COLOUR ? `\u001b[32m${text}\u001b[0m` : text);

function stamp() {
  return dim(new Date().toTimeString().slice(0, 8));
}

const log = (...parts) => console.log(stamp(), ...parts);
const fail = (...parts) => console.error(stamp(), red('error'), ...parts);

/* ------------------------------------------------------------------ config */

async function readConfig() {
  try {
    return JSON.parse(await readFile(CONFIG_PATH, 'utf8'));
  } catch {
    return { panel: null, token: null, agentId: null, agentName: null, repos: [] };
  }
}

/**
 * The pid of an agent already running here, if there is one.
 *
 * A stale file — the machine restarted, the process was killed -9 — is not an agent, so
 * signal 0 asks the kernel rather than trusting the file. Our own pid does not count.
 */
async function runningAgent() {
  let recorded;
  try {
    recorded = Number.parseInt((await readFile(LOCK_PATH, 'utf8')).trim(), 10);
  } catch {
    return null;
  }
  if (!Number.isInteger(recorded) || recorded <= 0 || recorded === process.pid) return null;
  try {
    process.kill(recorded, 0);
    return recorded;
  } catch {
    return null;
  }
}

async function writeConfig(config) {
  await mkdir(CONFIG_DIR, { recursive: true, mode: 0o700 });
  await writeFile(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
}

/* -------------------------------------------------------------- the machine */

const whichCache = new Map();

/**
 * Which program a name means on this machine.
 *
 * The agent is started from a terminal but outlives it, and it does not get the PATH a
 * person's shell builds for them: no nvm, no pyenv, no direnv. Worse, PATH can resolve a
 * name to the *wrong* copy — a `pip install` of a tool that is also a Claude Code plugin
 * will shadow the plugin's complete installation with an incomplete one, and the gate
 * fails somewhere deep inside the tool with a message about its own internals.
 *
 * So a machine can pin a path per binary, and nothing guesses around that choice. Without
 * a pin this is an ordinary PATH search with the usual places a Mac hides things.
 */
async function which(binary, config) {
  if (!BINARIES.includes(binary)) return null;
  if (whichCache.has(binary)) return whichCache.get(binary);

  const pinned = config?.binaries?.[binary];
  if (pinned) {
    try {
      await access(pinned, constants.X_OK);
      whichCache.set(binary, pinned);
      return pinned;
    } catch {
      // A pin that no longer exists is worth saying out loud: falling back silently would
      // run the copy the person pinned their way out of.
      fail(`${binary} is pinned to ${pinned}, which is not executable`);
      whichCache.set(binary, null);
      return null;
    }
  }

  const extras = ['/opt/homebrew/bin', '/usr/local/bin', join(homedir(), '.local/bin')];
  const directories = [...(process.env.PATH ?? '').split(delimiter), ...extras].filter(Boolean);
  for (const directory of directories) {
    const candidate = join(directory, binary);
    try {
      await access(candidate, constants.X_OK);
      whichCache.set(binary, candidate);
      return candidate;
    } catch {
      /* keep looking */
    }
  }
  whichCache.set(binary, null);
  return null;
}

/** The Claude Code account this machine is signed in to, for stamping runs with a person. */
async function claudeAccount() {
  try {
    const raw = JSON.parse(await readFile(join(homedir(), '.claude.json'), 'utf8'));
    const account = raw?.oauthAccount;
    if (!account?.emailAddress) return null;
    return {
      email: account.emailAddress,
      name: account.fullName ?? account.displayName ?? account.emailAddress,
    };
  } catch {
    return null;
  }
}

/** The role a repository declares for itself, written by `wizrelay init`. */
async function declaredRole(path) {
  try {
    const raw = JSON.parse(await readFile(join(path, '.wizrelay', 'config.json'), 'utf8'));
    return typeof raw?.role === 'string' ? raw.role : null;
  } catch {
    return null;
  }
}

async function currentBranch(path, config) {
  const git = await which('git', config);
  if (!git) return undefined;
  return new Promise((done) => {
    const child = spawn(git, ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: path, shell: false });
    let out = '';
    child.stdout.on('data', (chunk) => {
      out += chunk.toString('utf8');
    });
    child.on('error', () => done(undefined));
    child.on('close', (code) => done(code === 0 ? out.trim() || undefined : undefined));
  });
}

async function originRepo(path, config) {
  const git = await which('git', config);
  if (!git) return undefined;
  return new Promise((done) => {
    const child = spawn(git, ['config', '--get', 'remote.origin.url'], { cwd: path, shell: false });
    let out = '';
    child.stdout.on('data', (chunk) => {
      out += chunk.toString('utf8');
    });
    child.on('error', () => done(undefined));
    child.on('close', (code) => {
      if (code !== 0) return done(undefined);
      const url = out.trim();
      const match = url.match(/[:/]([^/:]+\/[^/]+?)(?:\.git)?$/);
      done(match ? match[1] : undefined);
    });
  });
}

/* ------------------------------------------------------------------ refusal */

function normalisePath(path) {
  const collapsed = path.replace(/\\/g, '/').replace(/\/+/g, '/');
  return collapsed.length > 1 && collapsed.endsWith('/') ? collapsed.slice(0, -1) : collapsed;
}

function climbs(path) {
  return normalisePath(path).split('/').includes('..');
}

function isPathInside(root, candidate) {
  const base = normalisePath(root);
  const target = normalisePath(candidate);
  if (!base || !target) return false;
  // `/repos/hub/../../.ssh/config` begins with `/repos/hub/` and is not in it. This
  // compares text, not what the filesystem would make of it, so a `..` is refused
  // outright rather than resolved.
  if (climbs(base) || climbs(target)) return false;
  if (target === base) return true;
  return target.startsWith(`${base}/`);
}

/**
 * The check that protects this machine.
 *
 * The panel runs the same one before sending, but only this copy runs on hardware the
 * person controls, so this is the one that counts.
 */
function refuseFileJob(job, roots) {
  const path = job.path;
  if (!path) return 'no file named';
  if (path.includes('\0')) return 'null byte in path';
  if (!roots.some((root) => isPathInside(root, path))) {
    return `outside every folder this machine offers: ${path}`;
  }

  if (job.kind === 'list') return null;

  const allowed = job.kind === 'write' ? WRITABLE_SUFFIXES : READABLE_SUFFIXES;
  const lower = path.toLowerCase();
  if (!allowed.some((suffix) => lower.endsWith(suffix))) {
    return `${job.kind} not allowed for this kind of file: ${path}`;
  }

  if (job.kind === 'write' && Buffer.byteLength(job.body ?? '', 'utf8') > FILE_MAX_BYTES) {
    return 'file too large to write';
  }

  return null;
}

function refuseJob(job, roots) {
  if (job.kind === 'read' || job.kind === 'write' || job.kind === 'list') {
    return refuseFileJob(job, roots);
  }

  if (!BINARIES.includes(job.binary)) return `binary not allowed: ${job.binary}`;

  if (job.binary === 'git') {
    const subcommand = job.args.find((argument) => !argument.startsWith('-'));
    if (!subcommand || !GIT_SUBCOMMANDS.includes(subcommand)) {
      return `git subcommand not allowed: ${subcommand ?? '(none)'}`;
    }
    const bad = job.args.find((argument) =>
      GIT_FORBIDDEN_ARGS.some((forbidden) => argument === forbidden || argument.startsWith(`${forbidden}=`)),
    );
    if (bad) return `git argument not allowed: ${bad}`;
  }

  if (job.kind !== 'which') {
    if (!job.cwd) return 'no working copy named';
    if (!roots.some((root) => isPathInside(root, job.cwd))) {
      return `outside every folder this machine offers: ${job.cwd}`;
    }
  }

  return null;
}

/* ------------------------------------------------------------------ the api */

class Panel {
  constructor(base, token) {
    this.base = base.replace(/\/+$/, '');
    this.token = token;
  }

  async call(path, { method = 'GET', body, timeoutMs = 35_000 } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${this.base}${path}`, {
        method,
        headers: {
          'content-type': 'application/json',
          ...(this.token ? { authorization: `Bearer ${this.token}` } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
      const text = await response.text();
      let parsed = null;
      try {
        parsed = text ? JSON.parse(text) : null;
      } catch {
        parsed = null;
      }
      return { ok: response.ok, status: response.status, body: parsed, text };
    } finally {
      clearTimeout(timer);
    }
  }
}

/* ---------------------------------------------------------------- execution */

async function runJob(job, config, onChunk) {
  const binary = await which(job.binary, config);
  if (!binary) {
    return { code: 127, stdout: '', stderr: '', timedOut: false, error: 'binary-missing' };
  }

  return new Promise((done) => {
    const child = spawn(binary, job.args, {
      cwd: job.cwd,
      shell: false,
      env: childEnv(),
      // Closed, not inherited. `claude -p` otherwise waits three seconds for input that
      // never comes and warns about it, which costs every conversational gate three
      // seconds and puts a fault-shaped message in the console.
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const buffers = { stdout: '', stderr: '' };

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
    }, job.timeoutMs ?? 300_000);

    const reader = (stream) => (chunk) => {
      const text = chunk.toString('utf8');
      if (stream === 'stdout') stdout += text;
      else stderr += text;

      if (!onChunk) return;
      buffers[stream] += text;
      const lines = buffers[stream].split('\n');
      buffers[stream] = lines.pop() ?? '';
      for (const line of lines) onChunk(stream, line);
    };

    child.stdout.on('data', reader('stdout'));
    child.stderr.on('data', reader('stderr'));

    child.on('error', (error) => {
      clearTimeout(timer);
      done({ code: -1, stdout, stderr, timedOut, error: String(error.message ?? error) });
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (onChunk) {
        for (const stream of ['stdout', 'stderr']) {
          if (buffers[stream]) onChunk(stream, buffers[stream]);
        }
      }
      done({ code: code ?? -1, stdout, stderr, timedOut });
    });
  });
}

/* --------------------------------------------------------------- staying up */

/**
 * The agent is a thing people start in a terminal and forget about, so the two ways it can
 * disappear both have to be closed.
 *
 * Node ends the process on an unhandled rejection, and an agent that vanishes between a
 * panel restart and the next time somebody presses a button looks exactly like a panel
 * that is broken. Anything unexpected is logged and the loop carries on; the only exits
 * are the ones with a sentence attached.
 */
function stayUp() {
  process.on('unhandledRejection', (reason) => {
    fail(`unexpected: ${reason?.message ?? reason}`);
  });
  process.on('uncaughtException', (error) => {
    fail(`unexpected: ${error?.message ?? error}`);
  });
  process.on('exit', (code) => {
    if (code !== 0) console.error(stamp(), red('the agent stopped.'), dim('start it again to keep taking work'));
  });
}

/* ------------------------------------------------------------- the commands */

/**
 * Keep a copy where the next command can find it.
 *
 * The agent is downloaded from the panel into whatever folder the person happened to be
 * in — often /tmp — and then has to be run again twice more. Copying itself next to its
 * own config means every command after pairing has one stable path, and re-pairing after
 * a panel upgrade replaces the copy with the version that panel speaks.
 */
async function installSelf() {
  const from = fileURLToPath(import.meta.url);
  if (from === INSTALL_PATH) return INSTALL_PATH;
  try {
    const source = await readFile(from, 'utf8');
    await mkdir(CONFIG_DIR, { recursive: true, mode: 0o700 });
    await writeFile(INSTALL_PATH, source, 'utf8');
    await chmod(INSTALL_PATH, 0o755);
    return INSTALL_PATH;
  } catch {
    // Running from somewhere unreadable is survivable: the person keeps using the path
    // they already have, which is the one they just typed.
    return from;
  }
}


function usage() {
  const self = `node ${INSTALL_PATH}`;
  console.log(`wizrelay-gate agent ${AGENT_VERSION}

  ${self} pair <code> --panel <url> [--name <machine>]
  ${self} add <path> [--role <role>]
  ${self} remove <role>
  ${self} repos
  ${self} use <binary> <path|auto>
  ${self} status
  ${self} run [--once] [--dry-run]

Get the agent from the panel it pairs with:
  curl -fsSL <panel>/agent -o /tmp/wizrelay-agent.mjs

The pairing code comes from the panel: Connections -> This machine -> Pair a machine.
Everything is kept in ${CONFIG_DIR}.`);
}

function flag(argv, name) {
  const index = argv.indexOf(`--${name}`);
  return index === -1 ? undefined : argv[index + 1];
}

async function cmdPair(argv) {
  const code = argv[0];
  const panel = flag(argv, 'panel') ?? process.env.WIZRELAY_GATE_PANEL;
  if (!code || !panel) {
    fail('a code and --panel <url> are both needed');
    process.exitCode = 2;
    return;
  }

  const api = new Panel(panel, null);
  const response = await api.call('/api/agent/pair', {
    method: 'POST',
    body: {
      code,
      hostname: flag(argv, 'name') ?? hostname(),
      platform: `${platform()} ${process.arch}`,
      agentVersion: AGENT_VERSION,
      protocol: PROTOCOL,
    },
  });

  if (!response.ok) {
    fail(
      response.body?.error === 'code'
        ? 'that code is not valid any more — open the panel and make a new one'
        : `the panel answered ${response.status}`,
    );
    process.exitCode = 1;
    return;
  }

  const config = await readConfig();
  await writeConfig({
    ...config,
    panel: api.base,
    token: response.body.token,
    agentId: response.body.agentId,
    agentName: response.body.agentName,
    repos: config.repos ?? [],
  });

  const self = await installSelf();
  log(green('paired'), `as ${bold(response.body.agentName)} for ${response.body.userName}`);
  log(dim(`panel: ${api.base} · ${response.body.panelName}`));
  log(dim(`agent: ${self}`));
  log('next: add a working copy, then start the agent');
  log(dim(`  node ${self} add ~/Repos/your-service`));
  log(dim(`  node ${self} run`));
}

async function cmdAdd(argv) {
  const given = argv[0];
  if (!given) {
    fail(`which folder? node ${INSTALL_PATH} add <path> [--role <role>]`);
    process.exitCode = 2;
    return;
  }

  const path = resolve(given.startsWith('~') ? join(homedir(), given.slice(1)) : given);
  try {
    await access(path, constants.R_OK);
  } catch {
    fail(`no such folder: ${path}`);
    process.exitCode = 1;
    return;
  }

  const role = flag(argv, 'role') ?? (await declaredRole(path));
  if (!role) {
    fail(
      `that folder does not say which role it plays — add --role <role>, or "hub" for the research hub`,
    );
    process.exitCode = 2;
    return;
  }

  const config = await readConfig();
  const repos = (config.repos ?? []).filter((entry) => entry.role !== role);
  repos.push({ role, path, repo: await originRepo(path) });
  await writeConfig({ ...config, repos });
  log(green('added'), `${bold(role)} → ${path}`);
  log(dim('a running agent picks this up on its next job; no restart needed'));
}

async function cmdRemove(argv) {
  const role = argv[0];
  const config = await readConfig();
  const repos = (config.repos ?? []).filter((entry) => entry.role !== role);
  await writeConfig({ ...config, repos });
  log(green('removed'), role);
}

async function cmdRepos() {
  const config = await readConfig();
  if (!config.repos?.length) {
    log('no working copies yet —', dim(`node ${INSTALL_PATH} add <path>`));
    return;
  }
  for (const entry of config.repos) {
    const branch = await currentBranch(entry.path, config);
    log(`${bold(entry.role.padEnd(16))} ${entry.path}${branch ? dim(` (${branch})`) : ''}`);
  }
}

async function helloBody(config) {
  const repos = [];
  for (const entry of config.repos ?? []) {
    repos.push({
      role: entry.role,
      path: entry.path,
      repo: entry.repo ?? (await originRepo(entry.path, config)),
      branch: await currentBranch(entry.path, config),
    });
  }

  const binaries = {};
  for (const binary of BINARIES) binaries[binary] = Boolean(await which(binary, config));

  const claude = await claudeAccount();
  return {
    protocol: PROTOCOL,
    agentVersion: AGENT_VERSION,
    hostname: hostname(),
    platform: `${platform()} ${process.arch}`,
    claude: { available: binaries.claude === true, ...(claude ?? {}) },
    binaries,
    repos,
  };
}

async function cmdUse(argv) {
  const [binary, given] = argv;
  if (!binary || !BINARIES.includes(binary)) {
    fail(`which program? one of ${BINARIES.join(', ')}`);
    process.exitCode = 2;
    return;
  }

  const config = await readConfig();
  const binaries = { ...(config.binaries ?? {}) };

  if (!given || given === 'auto') {
    delete binaries[binary];
    await writeConfig({ ...config, binaries });
    whichCache.clear();
    const found = await which(binary, { binaries });
    log(green('cleared'), `${binary} is found on PATH again: ${found ?? dim('nowhere')}`);
    return;
  }

  const path = resolve(given.startsWith('~') ? join(homedir(), given.slice(1)) : given);
  try {
    await access(path, constants.X_OK);
  } catch {
    fail(`not an executable: ${path}`);
    process.exitCode = 1;
    return;
  }

  binaries[binary] = path;
  await writeConfig({ ...config, binaries });
  log(green('pinned'), `${bold(binary)} → ${path}`);
}

async function cmdStatus() {
  const config = await readConfig();
  if (!config.token) {
    log('not paired —', dim(`node ${INSTALL_PATH} pair <code> --panel <url>`));
    return;
  }
  const api = new Panel(config.panel, config.token);
  const hello = await helloBody(config);
  const response = await api.call('/api/agent/hello', { method: 'POST', body: hello });

  log(`panel    ${config.panel}`);
  log(`machine  ${config.agentName ?? hostname()}`);
  log(`reachable ${response.ok ? green('yes') : red(`no (${response.status})`)}`);
  for (const binary of BINARIES) {
    const path = await which(binary, config);
    const pinned = config.binaries?.[binary] ? dim(' (pinned)') : '';
    log(`  ${binary.padEnd(10)} ${path ? `${green('found')} ${dim(path)}${pinned}` : dim('missing')}`);
  }
  log(`  claude as ${hello.claude.email ?? dim('not signed in')}`);
  await cmdRepos();
}

async function cmdRun(argv) {
  const once = argv.includes('--once');
  const dryRun = argv.includes('--dry-run');
  stayUp();
  const config = await readConfig();

  if (!config.token || !config.panel) {
    fail(`not paired yet — node ${INSTALL_PATH} pair <code> --panel <url>`);
    process.exitCode = 2;
    return;
  }
  if (!config.repos?.length) {
    fail(`no working copies — node ${INSTALL_PATH} add <path>`);
    process.exitCode = 2;
    return;
  }

  /**
   * One agent per machine.
   *
   * Nothing stopped a second `run` from starting, and nothing looked wrong when one did:
   * every copy polls the same panel with the same token, so a job goes to whichever asked
   * first. An older copy still holds the folders it read at startup, so it refuses work in
   * a folder that has since been added — naming that folder, which reads as nonsense to
   * the person who just added it.
   *
   * A pid file rather than a port or a socket: the agent binds nothing, and the one
   * question worth asking is whether that process is still alive.
   */
  const holder = await runningAgent();
  if (holder) {
    fail(`another agent is already running on this machine (pid ${holder}).`);
    log(dim('  Stop that one first, or leave it working — one is all a machine needs.'));
    log(dim(`  kill ${holder}`));
    process.exitCode = 1;
    return;
  }
  await writeFile(LOCK_PATH, String(process.pid), 'utf8').catch(() => {});
  const dropLock = async () => {
    try {
      if ((await readFile(LOCK_PATH, 'utf8')).trim() === String(process.pid)) await rm(LOCK_PATH);
    } catch {
    }
  };

  const api = new Panel(config.panel, config.token);

  /**
   * The working copies, read fresh each time a job arrives.
   *
   * `add` writes to the config file, and this loop outlives it: an agent started before
   * the hub was registered held the three folders it knew about and refused a job in the
   * fourth with "outside every folder this machine offers" — naming the folder that had
   * just been added. One small JSON read per job is cheaper than that sentence.
   *
   * The token and the panel are not re-read. Those are the pairing, and re-pairing while
   * a job is in flight is not something this loop should discover halfway through.
   */
  let live = config;
  const freshen = async () => {
    try {
      const next = await readConfig();
      if (next?.repos?.length) {
        // `which` remembers for the life of the process, including a `null`. An agent
        // started before `use` pinned a program cached "not here" and kept answering
        // that — the pin arrived, the config was re-read, and the answer never changed.
        // Forgetting is cheap; a job refused for a program that is right there is not.
        if (JSON.stringify(next.binaries ?? {}) !== JSON.stringify(live.binaries ?? {})) {
          whichCache.clear();
        }
        live = { ...live, repos: next.repos, binaries: next.binaries };
      }
    } catch {
      // Keep what we had: an unreadable config is not a reason to stop working.
    }
    return live.repos.map((entry) => entry.path);
  };

  log(`${bold(config.agentName ?? hostname())} → ${config.panel}`);
  for (const entry of config.repos) log(dim(`  ${entry.role.padEnd(16)} ${entry.path}`));
  if (dryRun) log(red('dry run: commands are reported as refused, never started'));
  log('waiting for work. ctrl-c to stop.');

  let lastHello = 0;
  let backoff = RETRY_MIN_MS;
  let quiet = false;
  let stop = false;
  process.on('SIGINT', () => {
    stop = true;
    log('stopping');
    void dropLock().finally(() => process.exit(0));
  });

  while (!stop) {
    try {
      if (Date.now() - lastHello > HELLO_EVERY_MS) {
        await freshen();
        const hello = await api.call('/api/agent/hello', { method: 'POST', body: await helloBody(live) });
        if (hello.status === 401) {
          fail('this machine is not paired any more — pair it again');
          process.exitCode = 1;
          return;
        }
        if (hello.status === 409) {
          fail(`the panel speaks protocol ${hello.body?.expected}; this agent speaks ${PROTOCOL}. Update the agent.`);
          process.exitCode = 1;
          return;
        }
        lastHello = Date.now();
      }

      const next = await api.call(`/api/agent/jobs?wait=${POLL_WAIT_MS}`, { timeoutMs: POLL_WAIT_MS + 10_000 });
      backoff = RETRY_MIN_MS;
      if (next.status === 401) {
        fail('this machine is not paired any more — pair it again');
        process.exitCode = 1;
        return;
      }
      if (!next.ok) {
        // A panel that is restarting, behind a proxy that hiccuped, or briefly down. Say
        // it once and keep waiting; this is the common case on a laptop, not a failure.
        if (!quiet) {
          log(dim(`panel answered ${next.status}; waiting`));
          quiet = true;
        }
        await new Promise((done) => setTimeout(done, RETRY_MIN_MS));
        continue;
      }
      if (quiet) {
        log(green('panel is back'));
        quiet = false;
      }

      const job = next.body?.job;
      if (!job) {
        if (once) return;
        continue;
      }

      await handle(api, job, await freshen(), dryRun, live);
      if (once) return;
    } catch (error) {
      // The panel being unreachable is ordinary: a laptop sleeps, a VPN drops. Say it once
      // per back-off rather than once per attempt, and keep trying.
      if (!quiet) {
        fail(`${error?.message ?? error} — retrying`);
        quiet = true;
      }
      await new Promise((done) => setTimeout(done, backoff));
      backoff = Math.min(backoff * 2, RETRY_MAX_MS);
      // The hello is what marks this machine online, so a reconnection has to send one
      // rather than wait out the rest of its interval.
      lastHello = 0;
    }
  }
}

/**
 * Read or write one file in a declared working copy.
 *
 * `refuseJob` has already said this path is allowed; what is left is doing it carefully.
 * A read of something enormous is refused rather than streamed, because the caller is a
 * panel drawing a document and a hundred megabytes is not one. A write replaces the file
 * whole, which is what the panel's editor means by saving.
 */
async function handleFile(api, job) {
  const report = (result) =>
    api.call(`/api/agent/jobs/${job.id}`, { method: 'POST', body: { result } });

  try {
    if (job.kind === 'list') {
      // Names and sizes, one JSON object per line, so a folder of a hundred files is one
      // small answer rather than a hundred round trips.
      const names = await readdir(job.path, { withFileTypes: true, recursive: true });
      const rows = [];
      for (const entry of names) {
        if (!entry.isFile()) continue;
        const parent = entry.parentPath ?? entry.path ?? job.path;
        const full = join(parent, entry.name);
        const info = await stat(full).catch(() => null);
        if (!info) continue;
        rows.push(JSON.stringify({ path: relative(job.path, full), bytes: info.size }));
      }
      log(dim(`list ${job.path}: ${rows.length} file(s)`));
      await report({ code: 0, stdout: rows.join('\n'), stderr: '', timedOut: false });
      return;
    }

    if (job.kind === 'read') {
      const info = await stat(job.path);
      if (!info.isFile()) {
        await report({ code: 1, stdout: '', stderr: 'not a file', timedOut: false });
        return;
      }
      if (info.size > FILE_MAX_BYTES) {
        await report({ code: 1, stdout: '', stderr: 'file too large', timedOut: false });
        return;
      }
      const body = await readFile(job.path, 'utf8');
      log(dim(`read ${job.path} (${info.size} B)`));
      await report({ code: 0, stdout: body, stderr: '', timedOut: false });
      return;
    }

    await mkdir(dirname(job.path), { recursive: true });
    await writeFile(job.path, job.body ?? '', 'utf8');
    log(green('wrote'), job.path);
    await report({ code: 0, stdout: '', stderr: '', timedOut: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await report({ code: 1, stdout: '', stderr: message, timedOut: false });
  }
}

async function handle(api, job, roots, dryRun, config) {
  const where = job.cwd ? dim(` in ${job.cwd}`) : '';
  const refusal = refuseJob(job, roots) ?? (dryRun ? 'dry run' : null);

  if (refusal) {
    log(red('refused'), job.command, where, dim(`— ${refusal}`));
    await api.call(`/api/agent/jobs/${job.id}`, {
      method: 'POST',
      body: { result: { code: -1, stdout: '', stderr: '', timedOut: false, error: refusal } },
    });
    return;
  }

  if (job.kind === 'read' || job.kind === 'write' || job.kind === 'list') {
    await handleFile(api, job);
    return;
  }

  if (job.kind === 'which') {
    const found = Boolean(await which(job.binary, config));
    log(dim(`which ${job.binary}: ${found ? 'found' : 'missing'}`));
    await api.call(`/api/agent/jobs/${job.id}`, {
      method: 'POST',
      body: { result: { code: found ? 0 : 1, stdout: '', stderr: '', timedOut: false } },
    });
    return;
  }

  log(bold('run'), job.command, where);
  const started = Date.now();

  if (job.kind === 'stream') {
    let seq = 0;
    let pending = { stdout: [], stderr: [] };
    let flushing = null;
    let inFlight = Promise.resolve();

    /*
     * One request per flush, one row per request.
     *
     * A Claude session with partial messages on emits a line per token. A request each
     * would spend longer in HTTP than in the session, and a row each would leave a
     * keystroke dump in the panel's database — so what arrives between round trips goes
     * up as a single newline-joined line, which the panel splits again. The interval is
     * short enough to read as typing and long enough that a fast answer is a handful of
     * requests rather than a thousand.
     */
    const flush = () => {
      const chunks = [];
      for (const stream of ['stdout', 'stderr']) {
        if (pending[stream].length === 0) continue;
        chunks.push({ seq: seq++, stream, line: pending[stream].join('\n') });
        pending[stream] = [];
      }
      if (chunks.length === 0) return inFlight;
      inFlight = inFlight
        .then(() => api.call(`/api/agent/jobs/${job.id}`, { method: 'POST', body: { chunks } }))
        .catch(() => {});
      return inFlight;
    };

    const result = await runJob(job, config, (stream, line) => {
      pending[stream].push(line.slice(0, MAX_LINE));
      // A long burst goes before the timer does, so a big answer does not arrive in one lump.
      if (pending[stream].length >= 64) {
        if (flushing) {
          clearTimeout(flushing);
          flushing = null;
        }
        void flush();
        return;
      }
      if (!flushing) {
        flushing = setTimeout(() => {
          flushing = null;
          void flush();
        }, STREAM_FLUSH_MS);
      }
    });

    if (flushing) clearTimeout(flushing);
    await flush();
    await inFlight;
    await api.call(`/api/agent/jobs/${job.id}`, { method: 'POST', body: { result } });
    log(dim(`done in ${Math.round((Date.now() - started) / 1000)}s · exit ${result.code}`));
    return;
  }

  const result = await runJob(job, config);
  await api.call(`/api/agent/jobs/${job.id}`, { method: 'POST', body: { result } });
  log(
    result.code === 0 ? green('ok') : red(`exit ${result.code}`),
    dim(`${Math.round((Date.now() - started) / 1000)}s`),
  );
}

/* -------------------------------------------------------------------- entry */

const [, , command = 'run', ...rest] = process.argv;

switch (command) {
  case 'pair':
    await cmdPair(rest);
    break;
  case 'add':
    await cmdAdd(rest);
    break;
  case 'remove':
    await cmdRemove(rest);
    break;
  case 'repos':
    await cmdRepos();
    break;
  case 'use':
    await cmdUse(rest);
    break;
  case 'status':
    await cmdStatus();
    break;
  case 'run':
    await cmdRun(rest);
    break;
  case 'help':
  case '--help':
  case '-h':
    usage();
    break;
  default:
    fail(`unknown command: ${command}`);
    usage();
    process.exitCode = 2;
}
