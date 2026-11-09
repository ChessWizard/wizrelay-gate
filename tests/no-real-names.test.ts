import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * No real company, person, repository or task in a public repository.
 *
 * Every example here was once a real one — a client's repositories, a name in an identity
 * test, live tracker ids in the documentation. They read as placeholders to whoever wrote
 * them and as a customer list to everybody else, and once pushed they are in the history
 * as well as in the files. Repository names and task titles leak the same thing in a
 * quieter voice: an example called after a real service is still a description of
 * somebody's systems.
 *
 * The words themselves are not written down, not even split into pieces — a guard that
 * spells what it forbids is the last file anybody thinks to check, and it publishes the
 * list it exists to suppress. What is stored is a digest of each one. The test hashes
 * every word in every tracked file, and in the joins of adjacent words, so a name written
 * as `one-two-three` is caught as surely as a single token.
 *
 * To add a word: hash it the same way and paste the digest. To find out what a failing
 * digest stands for, hash your suspicion and compare — which is the only direction this
 * works in, and deliberately so. The scanner proves itself against a word of no
 * significance, so even the proof names nothing.
 */
const FORBIDDEN = new Set([
  '98f8e144ed33dd7a',
  '3fef70a9fad61f12',
  '393b414b9aa0900a',
  '3880a78d28931b61',
  '0cf6855c1a3c323b',
  'ec8202b6f9fb16f9',
  '8e6b400b000c97e0',
  '380110eaa39cf2a7',
  'e5d8a429b009b8b2',
  'b178ca1995ad8708',
  '531e30022a9be720',
  '46658fd02b427f35',
  'bab1e56a91479be4',
  '7af17e9416baadb9',
  'd3438ffd7cfe5ccd',
]);

const digest = (value: string) =>
  createHash('sha256').update(value, 'utf8').digest('hex').slice(0, 16);

/** Files big enough to hold prose, and nothing a lock file or a binary would drown it in. */
function textFiles(): string[] {
  return execFileSync('git', ['ls-files'], { encoding: 'utf8' })
    .split('\n')
    .filter(Boolean)
    .filter((path) => !path.endsWith('package-lock.json'))
    .filter((path) => !/\.(png|jpe?g|gif|ico|webp|woff2?|mp4|mov|webm|gz|zip|pdf)$/i.test(path));
}

/**
 * Each word, and each hyphenated run joined up.
 *
 * `one-two-three` is how a repository is named, so the run is tested whole as well as in
 * parts. Words are not joined across whitespace: `1000 s entry` would then read as a
 * product name, and a guard that cries wolf is one somebody turns off.
 */
function offendingWords(text: string): string[] {
  const runs = (text.toLowerCase().match(/[\p{L}\p{N}]+(?:[-_][\p{L}\p{N}]+)*/gu) ?? []).slice(
    0,
    200_000,
  );
  const found: string[] = [];

  for (const run of runs) {
    const parts = run.split(/[-_]/).filter(Boolean);
    for (const candidate of [run.replace(/[-_]/g, ''), ...parts]) {
      const hash = digest(candidate);
      if (FORBIDDEN.has(hash)) found.push(hash);
    }
  }
  return found;
}

describe('what a public repository may not contain', () => {
  it('says none of it, in any tracked file', () => {
    const offenders: string[] = [];

    for (const path of textFiles()) {
      let text: string;
      try {
        text = readFileSync(path, 'utf8');
      } catch {
        continue;
      }
      for (const hit of offendingWords(text)) offenders.push(`${path} (${hit})`);
    }

    expect([...new Set(offenders)]).toEqual([]);
  });

  it('has files to read, so a broken lookup cannot pass silently', () => {
    expect(textFiles().length).toBeGreaterThan(100);
  });

  it('would catch a name if one came back', () => {
    const canary = 'zzqq-unlikely-token';
    FORBIDDEN.add(digest(canary.replace(/-/g, '')));
    try {
      expect(offendingWords(`a ${canary} in the text`)).not.toEqual([]);
      expect(offendingWords('nothing of the sort here')).toEqual([]);
    } finally {
      FORBIDDEN.delete(digest(canary.replace(/-/g, '')));
    }
  });
});
