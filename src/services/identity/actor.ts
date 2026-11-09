import { readFile } from 'node:fs/promises';
import { homedir, userInfo } from 'node:os';
import { join } from 'node:path';
import type { Actor } from '@/core/identity/actor';
import { UNKNOWN_ACTOR } from '@/core/identity/actor';
import { run } from '@/services/shell/exec';

/**
 * The identity service: it reads who is working here, and never writes anything anywhere.
 *
 * The dashboard needs an author for every run so that a team can see who answered which
 * prompt, and a membership system would need a database and a server — which this product
 * does not have and should not grow. Two identities already exist on the machine:
 *
 *   1. The Claude Code account in `~/.claude.json`, which is the person's actual login.
 *   2. The git identity, which is what their commits will carry anyway.
 *
 * Both are local files belonging to the person using the app. Nothing read here leaves the
 * machine: the dashboard has no network calls, and the identity is written only into the
 * local store and into git commits the person makes themselves.
 */

interface ClaudeAccount {
  emailAddress?: string;
  displayName?: string;
  fullName?: string;
  organizationName?: string;
}

interface ClaudeConfig {
  oauthAccount?: ClaudeAccount;
}

/** `~/.claude.json`, which Claude Code writes when the person signs in. */
async function fromClaude(): Promise<Actor | null> {
  let raw: string;
  try {
    raw = await readFile(join(homedir(), '.claude.json'), 'utf8');
  } catch {
    return null;
  }

  let account: ClaudeAccount | undefined;
  try {
    account = (JSON.parse(raw) as ClaudeConfig).oauthAccount;
  } catch {
    return null;
  }
  if (!account?.emailAddress) return null;

  return {
    id: account.emailAddress,
    name: account.fullName ?? account.displayName ?? account.emailAddress,
    email: account.emailAddress,
    organization: account.organizationName,
    source: 'claude',
  };
}

/** `git config user.name` / `user.email`, read in the folder the work happens in. */
async function fromGit(cwd: string): Promise<Actor | null> {
  const read = async (key: string): Promise<string | undefined> => {
    try {
      const result = await run('git', ['config', '--get', key], { cwd, timeoutMs: 5_000 });
      const value = result.stdout.trim();
      return result.code === 0 && value ? value : undefined;
    } catch {
      return undefined;
    }
  };

  const [name, email] = await Promise.all([read('user.name'), read('user.email')]);
  if (!name && !email) return null;
  const resolved = email ?? name ?? '';
  return { id: resolved, name: name ?? resolved, email, source: 'git' };
}

function fromSystem(): Actor {
  try {
    const info = userInfo();
    return { id: info.username, name: info.username, source: 'system' };
  } catch {
    return UNKNOWN_ACTOR;
  }
}

/**
 * Whether a Claude Code session is driving this process.
 *
 * Claude Code exports `CLAUDE_CODE_ENTRYPOINT` into the environment of everything it
 * starts, so a dev server launched from a session inherits it. It says the app is running
 * inside a session — not that the `claude` binary is on PATH, which is a separate question
 * the engine asks.
 */
export function inClaudeSession(): boolean {
  return Boolean(process.env.CLAUDE_CODE_ENTRYPOINT ?? process.env.CLAUDECODE);
}

/**
 * The person working here, strongest claim first.
 *
 * Cached for the life of the process: an identity does not change while the server runs,
 * and reading three files on every render would show up on every page.
 */
let cached: Actor | null = null;

export async function currentActor(cwd?: string): Promise<Actor> {
  if (cached) return cached;

  const [claude, git] = await Promise.all([fromClaude(), fromGit(cwd ?? process.cwd())]);

  const primary = claude ?? git ?? fromSystem();
  const other = claude ? git : null;
  const aliases = [other?.name, other?.email].filter((value): value is string => Boolean(value));

  cached = aliases.length > 0 ? { ...primary, aliases } : primary;
  return cached;
}

export function forgetActor(): void {
  cached = null;
}
