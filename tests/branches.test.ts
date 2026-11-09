import { describe, expect, it } from 'vitest';
import { hubTaskBranch } from '@/core/gates/branches';

/**
 * A branch name git will accept, from a folder name a person wrote.
 *
 * The task's title reaches this through the folder, and a title is whatever somebody
 * typed into the tracker: brackets, Turkish letters, a trailing full stop. Git refuses
 * several of those outright, and a refused branch name fails the gate at the push rather
 * than where it was made.
 */
describe('the branch research is written on', () => {
  it('is named after the task', () => {
    expect(hubTaskBranch('CU-7fd2e914-cache-the-price-list')).toBe(
      'research/CU-7fd2e914-cache-the-price-list',
    );
  });

  it('replaces what git will not take', () => {
    expect(hubTaskBranch('CU-1 fix (the) cache!')).toBe('research/CU-1-fix-the-cache');
  });

  it('does not end in a dot or a dash, which git refuses', () => {
    for (const folder of ['CU-1-trailing.', 'CU-1-trailing-', 'CU-1 ...']) {
      const branch = hubTaskBranch(folder);
      expect(branch.endsWith('.'), branch).toBe(false);
      expect(branch.endsWith('-'), branch).toBe(false);
    }
  });

  it('keeps a long name to something a person can read', () => {
    const branch = hubTaskBranch('CU-1-' + 'x'.repeat(300));
    expect(branch.length).toBeLessThanOrEqual('research/'.length + 80);
  });

  it('still names a branch when the folder is empty or unusable', () => {
    expect(hubTaskBranch('')).toBe('research/task');
    expect(hubTaskBranch('***')).toBe('research/task');
  });

  it('is stable, because every step recomputes it', () => {
    expect(hubTaskBranch('CU-9-abc')).toBe(hubTaskBranch('CU-9-abc'));
  });
});
