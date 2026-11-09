import { describe, expect, it } from 'vitest';
import { FILE_MAX_BYTES, refuseJob } from '@/core/agent/protocol';
import type { AgentJobRequest } from '@/core/agent/protocol';

/**
 * What a machine will and will not do to its own disk.
 *
 * These jobs come from a panel somebody else may administer, over HTTP, naming absolute
 * paths. The machine applies this rule to itself before touching anything — the panel
 * applies it too, but only this copy runs on hardware the person controls.
 */
const ROOTS = ['/Users/me/Repos/hub', '/Users/me/Repos/core'];

const job = (over: Partial<AgentJobRequest>): AgentJobRequest =>
  ({
    id: 'j1',
    kind: 'read',
    binary: 'git',
    args: [],
    timeoutMs: 5_000,
    command: '',
    ...over,
  }) as AgentJobRequest;

describe('reading a file on somebody machine', () => {
  it('allows a package file inside a declared folder', () => {
    expect(refuseJob(job({ path: '/Users/me/Repos/hub/tasks/CU-1/acceptance.md' }), ROOTS)).toBeNull();
  });

  it('refuses a path outside every declared folder', () => {
    for (const path of ['/Users/me/.ssh/id_ed25519', '/etc/passwd', '/Users/me/Repos']) {
      expect(refuseJob(job({ path }), ROOTS)?.reason, path).toBe('cwd');
    }
  });

  it('refuses a traversal that resolves out, written as one path', () => {
    expect(refuseJob(job({ path: '/Users/me/Repos/hub/../../.ssh/config' }), ROOTS)?.reason).toBe('cwd');
  });

  it('refuses a file that is not text the package is made of', () => {
    const refusal = refuseJob(job({ path: '/Users/me/Repos/hub/.git/config' }), ROOTS);
    expect(refusal?.reason).toBe('file');
  });

  it('refuses a path with no path at all', () => {
    expect(refuseJob(job({ path: undefined }), ROOTS)?.reason).toBe('file');
  });
});

describe('writing a file on somebody machine', () => {
  const write = (over: Partial<AgentJobRequest>) => job({ kind: 'write', body: 'hello', ...over });

  it('allows prose inside a declared folder', () => {
    expect(refuseJob(write({ path: '/Users/me/Repos/hub/tasks/CU-1/research.md' }), ROOTS)).toBeNull();
  });

  it('refuses anything that is not prose, even where a read would be allowed', () => {
    // `task.json` is a tool's record; a machine should not take dictation over it.
    for (const path of ['/Users/me/Repos/hub/tasks/CU-1/task.json', '/Users/me/Repos/hub/x.yml']) {
      expect(refuseJob(write({ path }), ROOTS)?.reason, path).toBe('file');
    }
  });

  it('refuses a body larger than a document', () => {
    const body = 'x'.repeat(FILE_MAX_BYTES + 1);
    expect(refuseJob(write({ path: '/Users/me/Repos/hub/a.md', body }), ROOTS)?.detail).toBe(
      'too large',
    );
  });

  it('accepts a body exactly at the limit', () => {
    const body = 'x'.repeat(FILE_MAX_BYTES);
    expect(refuseJob(write({ path: '/Users/me/Repos/hub/a.md', body }), ROOTS)).toBeNull();
  });

  it('refuses a null byte in the path', () => {
    expect(refuseJob(write({ path: '/Users/me/Repos/hub/a\0b.md' }), ROOTS)?.reason).toBe('file');
  });
});

describe('the command rules still apply to commands', () => {
  it('refuses a binary that is not allowed', () => {
    expect(refuseJob(job({ kind: 'exec', binary: 'curl' as never, cwd: ROOTS[0] }), ROOTS)?.reason).toBe(
      'binary',
    );
  });
});
