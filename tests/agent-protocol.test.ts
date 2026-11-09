import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  AGENT_BINARIES,
  AGENT_GIT_SUBCOMMANDS,
  AGENT_PROTOCOL_VERSION,
  formatPairingCode,
  isAgentOnline,
  isPairingCode,
  isPathInside,
  normalisePairingCode,
  refuseJob,
  type AgentJobRequest,
} from '@/core/agent/protocol';

const AGENT = readFileSync(join(process.cwd(), 'public/wizrelay-agent.mjs'), 'utf8');

function job(partial: Partial<AgentJobRequest>): AgentJobRequest {
  return {
    id: 'j1',
    kind: 'exec',
    binary: 'wizrelay',
    args: ['status', '--json'],
    cwd: '/Users/dev/Repos/api',
    timeoutMs: 1_000,
    command: 'wizrelay status --json',
    ...partial,
  };
}

const ROOTS = ['/Users/dev/Repos/api', '/Users/dev/Repos/hub'];

describe('what an agent will run', () => {
  it('runs an allowlisted binary inside a declared working copy', () => {
    expect(refuseJob(job({}), ROOTS)).toBeNull();
  });

  it('refuses a binary nobody allowlisted', () => {
    const refusal = refuseJob(job({ binary: 'curl' as 'git' }), ROOTS);
    expect(refusal?.reason).toBe('binary');
  });

  it('refuses a git subcommand the gate planner never emits', () => {
    const refusal = refuseJob(job({ binary: 'git', args: ['filter-branch'] }), ROOTS);
    expect(refusal?.reason).toBe('git-subcommand');
  });

  it('allows the git subcommands the ship gate actually uses', () => {
    const steps: string[][] = [
      ['checkout', '-B', 'wizrelay/CU-1'],
      ['commit', '-am', 'CU-1: a message with spaces'],
      ['push', '-u', 'origin', 'wizrelay/CU-1'],
      ['config', '--get', 'user.email'],
    ];
    for (const args of steps) {
      expect(refuseJob(job({ binary: 'git', args }), ROOTS), args.join(' ')).toBeNull();
    }
  });

  it('refuses the git arguments that turn git into a shell', () => {
    for (const args of [
      ['-c', 'core.pager=sh -c "id"', 'log'],
      ['push', '--receive-pack=sh'],
      ['fetch', '--upload-pack=sh'],
    ]) {
      expect(refuseJob(job({ binary: 'git', args }), ROOTS)?.reason, args.join(' ')).toMatch(
        /git-(argument|subcommand)/,
      );
    }
  });

  it('refuses a folder the machine never offered', () => {
    expect(refuseJob(job({ cwd: '/etc' }), ROOTS)?.reason).toBe('cwd');
    expect(refuseJob(job({ cwd: undefined }), ROOTS)?.reason).toBe('cwd');
  });

  it('does not treat a sibling folder as being inside one', () => {
    expect(refuseJob(job({ cwd: '/Users/dev/Repos/api-secrets' }), ROOTS)?.reason).toBe('cwd');
    expect(isPathInside('/Users/dev/Repos/api', '/Users/dev/Repos/api-secrets')).toBe(false);
    expect(isPathInside('/Users/dev/Repos/api', '/Users/dev/Repos/api/src/app')).toBe(true);
    expect(isPathInside('/Users/dev/Repos/api/', '/Users/dev/Repos/api')).toBe(true);
  });

  it('lets a which job ask without naming a folder', () => {
    expect(refuseJob(job({ kind: 'which', binary: 'claude', args: [], cwd: undefined }), ROOTS)).toBeNull();
  });
});

describe('the pairing code', () => {
  it('is read back the way it is shown', () => {
    expect(formatPairingCode('ABCD2345')).toBe('ABCD-2345');
    expect(normalisePairingCode('abcd-2345')).toBe('ABCD2345');
    expect(isPairingCode('abcd-2345')).toBe(true);
  });

  it('refuses the characters that are misread off a screen', () => {
    for (const code of ['ABCD2340', 'ABCD234O', 'ABCD234I', 'ABCD234L', 'ABCD234']) {
      expect(isPairingCode(code), code).toBe(false);
    }
  });
});

describe('whether a machine is there', () => {
  it('counts a machine seen a moment ago and not one seen this morning', () => {
    const now = Date.parse('2026-11-08T12:00:00.000Z');
    expect(isAgentOnline(new Date(now - 10_000), now)).toBe(true);
    expect(isAgentOnline(new Date(now - 10 * 60_000), now)).toBe(false);
    expect(isAgentOnline(null, now)).toBe(false);
  });
});

/**
 * The agent ships as one dependency-free file, so it cannot import the module above. These
 * keep the copy honest: the moment the panel starts planning a command the agent would
 * refuse — or stops refusing one it should — this fails instead of a gate failing in front
 * of somebody.
 */
describe('the agent script agrees with the protocol', () => {
  function arrayIn(source: string, name: string): string[] {
    const match = source.match(new RegExp(`const ${name} = \\[([^\\]]*)\\]`));
    if (!match) throw new Error(`${name} not found in the agent script`);
    return [...match[1].matchAll(/'([^']+)'/g)].map((entry) => entry[1]);
  }

  it('allowlists the same binaries', () => {
    expect(arrayIn(AGENT, 'BINARIES').sort()).toEqual([...AGENT_BINARIES].sort());
  });

  it('allowlists the same git subcommands', () => {
    expect(arrayIn(AGENT, 'GIT_SUBCOMMANDS').sort()).toEqual([...AGENT_GIT_SUBCOMMANDS].sort());
  });

  it('speaks the same protocol version', () => {
    const match = AGENT.match(/const PROTOCOL = (\d+)/);
    expect(Number(match?.[1])).toBe(AGENT_PROTOCOL_VERSION);
  });

  it('never starts a shell', () => {
    expect(AGENT).not.toMatch(/shell:\s*true/);
    expect(AGENT).not.toMatch(/\bexec\(|execSync\(/);
  });
});
