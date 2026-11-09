import { describe, expect, it } from 'vitest';

/**
 * Pinning a program for the panel.
 *
 * `wizrelay` is both a Claude Code plugin and a pip-installable package, and the pip copy
 * carries the library without the tracker catalogue or the templates. When it comes first
 * on PATH the gates fail deep inside the tool — "Unknown tracker type 'clickup'" for a
 * hub whose tracker setting was never wrong. The name of the variable is the contract, so
 * it is pinned here.
 */
describe('the environment variable that pins a program', () => {
  it('is the program in capitals with _BIN, for each one the panel runs', () => {
    const name = (binary: string) => `${binary.replace(/[^A-Za-z0-9]/g, '').toUpperCase()}_BIN`;
    expect(name('wizrelay')).toBe('WIZRELAY_BIN');
    expect(name('git')).toBe('GIT_BIN');
    expect(name('claude')).toBe('CLAUDE_BIN');
    expect(name('python3')).toBe('PYTHON3_BIN');
  });
});
