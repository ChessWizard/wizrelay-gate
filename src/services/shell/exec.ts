import { spawn } from 'node:child_process';
import { constants } from 'node:fs';
import { access, mkdir } from 'node:fs/promises';
import { delimiter, join } from 'node:path';

/**
 * Every external command this app runs goes through here.
 *
 * Rules, borrowed from the plugin's own `gitcmd.py`: never a shell, always an argument
 * array, always a timeout, and only a binary from the allowlist. A dashboard that can be
 * told to run anything is a remote shell with a nice font.
 */
export const ALLOWED_BINARIES = ['wizrelay', 'git', 'claude', 'python3'] as const;
export type Binary = (typeof ALLOWED_BINARIES)[number];

export interface ExecResult {
  code: number;
  stdout: string;
  stderr: string;
  /** The command as a person would type it, for the UI's command block. */
  command: string;
  timedOut: boolean;
}

/**
 * A program the gate needs, which the machine running it cannot find.
 *
 * The message carries the remedy because this is the failure people meet most, and it is
 * almost never what it sounds like. A machine running gates is started from a terminal
 * and outlives it: it does not get the PATH a shell builds — no nvm, no pyenv, no plugin
 * directory Claude Code adds to its own tools. So `wizrelay` can be on PATH everywhere a
 * person looks and absent where the work happens.
 */
export class BinaryMissing extends Error {
  constructor(readonly binary: string) {
    super(
      `${binary} is not on PATH for the machine that runs the gates. ` +
        `Pin it: node ~/.wizrelay-gate/wizrelay-agent.mjs use ${binary} <path>, ` +
        `or check what the machine can see with: ... status`,
    );
    this.name = 'BinaryMissing';
  }
}

const whichCache = new Map<string, string | null>();

/**
 * An explicit path for one program, from the environment.
 *
 * `WIZRELAY_BIN`, `GIT_BIN`, `CLAUDE_BIN`, `PYTHON3_BIN`. PATH can resolve a name to the
 * wrong copy, and `wizrelay` is the one it does: it is both a Claude Code plugin and a
 * pip-installable package, and the pip copy carries the library without the tracker
 * catalogue or the templates. When it comes first on PATH every gate fails somewhere deep
 * inside the tool. The agent has `use` for this on a person's own machine; this is the
 * same escape hatch for the panel's.
 */
function pinned(binary: Binary): string | null {
  const name = `${binary.replace(/[^A-Za-z0-9]/g, '').toUpperCase()}_BIN`;
  const value = process.env[name]?.trim();
  return value ? value : null;
}

export async function which(binary: Binary): Promise<string | null> {
  const cached = whichCache.get(binary);
  if (cached !== undefined) return cached;

  const override = pinned(binary);
  if (override) {
    try {
      await access(override, constants.X_OK);
      whichCache.set(binary, override);
      return override;
    } catch {
      // A pin that does not resolve is reported as the program being missing, rather
      // than silently falling back to the copy somebody pinned their way out of.
      whichCache.set(binary, null);
      return null;
    }
  }

  const path = process.env.PATH ?? '';
  const extras = ['/opt/homebrew/bin', '/usr/local/bin', join(process.env.HOME ?? '', '.local/bin')];
  const directories = [...path.split(delimiter), ...extras].filter(Boolean);

  for (const directory of directories) {
    const candidate = join(directory, binary);
    try {
      await access(candidate, constants.X_OK);
      whichCache.set(binary, candidate);
      return candidate;
    } catch {
    }
  }
  whichCache.set(binary, null);
  return null;
}

export function forgetBinaryCache(): void {
  whichCache.clear();
}

/**
 * What Claude Code exports into everything it starts, and what a gate must not inherit.
 *
 * A panel started from inside a Claude Code session passes these on, and then `wizrelay`
 * sees a session id that never wrote a heartbeat and reports that scope protection is
 * off, while `claude -p` believes it is already inside a conversation. A gate's session
 * belongs to the gate.
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
] as const;

function childEnv(extra?: Record<string, string>): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, ...extra };
  for (const name of PARENT_SESSION_VARS) delete env[name];
  return env;
}

export interface ExecOptions {
  cwd: string;
  timeoutMs?: number;
  /** Extra environment entries; the parent environment is passed through. */
  env?: Record<string, string>;
}

export async function run(
  binary: Binary,
  args: string[],
  options: ExecOptions,
): Promise<ExecResult> {
  const resolved = await which(binary);
  if (!resolved) throw new BinaryMissing(binary);
  await mkdir(options.cwd, { recursive: true }).catch(() => {});

  const command = [binary, ...args].join(' ');
  return new Promise<ExecResult>((resolve, reject) => {
    const child = spawn( resolved, args, {
      cwd: options.cwd,
      shell: false,
      env: childEnv(options.env),

      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const timer = setTimeout(
      () => {
        timedOut = true;
        child.kill('SIGTERM');
      },
      options.timeoutMs ?? 60_000,
    );

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? -1, stdout, stderr, command, timedOut });
    });
  });
}

/**
 * A long-running command whose output is streamed line by line — how the console reads a
 * headless Claude session or a test run.
 */
export async function* runStreaming(
  binary: Binary,
  args: string[],
  options: ExecOptions,
): AsyncGenerator<{ stream: 'stdout' | 'stderr'; line: string } | { exit: number }> {
  const resolved = await which(binary);
  if (!resolved) throw new BinaryMissing(binary);

  const child = spawn( resolved, args, {
    cwd: options.cwd,
    shell: false,
    env: childEnv(options.env),
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  const queue: ({ stream: 'stdout' | 'stderr'; line: string } | { exit: number })[] = [];
  let notify: (() => void) | null = null;
  let finished = false;

  const push = (item: (typeof queue)[number]) => {
    queue.push(item);
    notify?.();
  };

  const reader = (stream: 'stdout' | 'stderr') => {
    let buffer = '';
    return (chunk: Buffer) => {
      buffer += chunk.toString('utf8');
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) push({ stream, line });
    };
  };

  child.stdout.on('data', reader('stdout'));
  child.stderr.on('data', reader('stderr'));
  child.on('close', (code) => {
    finished = true;
    push({ exit: code ?? -1 });
  });

  const timer = setTimeout(() => child.kill('SIGTERM'), options.timeoutMs ?? 900_000);

  try {
    while (!finished || queue.length > 0) {
      if (queue.length === 0) {
        await new Promise<void>((resolve) => {
          notify = () => {
            notify = null;
            resolve();
          };
        });
      }
      const item = queue.shift();
      if (item) yield item;
    }
  } finally {
    clearTimeout(timer);
    if (!finished) child.kill('SIGTERM');
  }
}
