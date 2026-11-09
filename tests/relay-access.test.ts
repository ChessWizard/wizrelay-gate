import { describe, expect, it } from 'vitest';
import type { Viewer } from '@/core/auth/roles';
import { canSeeAllActivity, canSeeRelay } from '@/core/auth/roles';

const PROJECTS = { 'api': 'p-core', 'web': 'p-edge' };

function viewer(partial: Partial<Viewer>): Viewer {
  return { id: 'u1', globalRole: 'MEMBER', projects: {}, ...partial };
}

/**
 * Who sees which task.
 *
 * The hub holds every team's packages and the scan reads all of them, so the filter is
 * the only thing between a member of one project and every task in the company. Not
 * seeing a task is the normal case here, which is why the negative tests matter more
 * than the positive one.
 */
describe('which relays a viewer may read', () => {
  it('shows a task to somebody who belongs to a project it names', () => {
    const developer = viewer({ projects: { 'p-edge': ['DEVELOPER'] } });
    expect(canSeeRelay(developer, ['web'], PROJECTS)).toBe(true);
  });

  it('hides a task whose projects they do not belong to', () => {
    const developer = viewer({ projects: { 'p-edge': ['DEVELOPER'] } });
    expect(canSeeRelay(developer, ['api'], PROJECTS)).toBe(false);
  });

  it('shows a multi-role task when they belong to any one of its projects', () => {
    const developer = viewer({ projects: { 'p-core': ['RESEARCHER'] } });
    expect(canSeeRelay(developer, ['web', 'api'], PROJECTS)).toBe(true);
  });

  it('hides a task naming a role no project is registered for', () => {
    const developer = viewer({ projects: { 'p-edge': ['DEVELOPER'] } });
    expect(canSeeRelay(developer, ['billing'], PROJECTS)).toBe(false);
  });

  it('hides everything from somebody with no membership at all', () => {
    expect(canSeeRelay(viewer({}), ['web'], PROJECTS)).toBe(false);
  });

  it('shows everything to an owner and an admin', () => {
    for (const globalRole of ['OWNER', 'ADMIN'] as const) {
      expect(canSeeRelay(viewer({ globalRole }), ['billing'], PROJECTS)).toBe(true);
    }
  });
});

describe('whose activity a viewer reads', () => {
  it('is their own unless they administer the panel', () => {
    expect(canSeeAllActivity(viewer({}))).toBe(false);
    expect(canSeeAllActivity(viewer({ projects: { 'p-edge': ['DEVELOPER'] } }))).toBe(false);
    expect(canSeeAllActivity(viewer({ globalRole: 'ADMIN' }))).toBe(true);
    expect(canSeeAllActivity(viewer({ globalRole: 'OWNER' }))).toBe(true);
  });
});

/**
 * A relay the hub scan did not produce.
 *
 * One this panel created whose package has not reached the hub yet, or one whose hub is
 * unreachable today. It used to be appended to the list after the filter and after the
 * sequence was recomputed, so it skipped both: visible to people with no membership in
 * its projects, and stuck on the `blocked` rows it was created with.
 */
describe('a relay that exists only in the panel', () => {
  it('is held to the same membership rule as one from the hub', () => {
    const developer = viewer({ projects: { 'p-edge': ['DEVELOPER'] } });
    expect(canSeeRelay(developer, ['api'], PROJECTS)).toBe(false);
  });
});
