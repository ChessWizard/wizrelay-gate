import { describe, expect, it } from 'vitest';
import {
  assignableGlobalRoles,
  canAssignProjectRoles,
  canChangeGlobalRole,
  canManagePanel,
  canManageUsers,
  canRunGate,
  canRunTrack,
  canSeeProject,
  hasProjectRole,
  isAdmin,
  isOwner,
  visibleProjectIds,
} from '@/core/auth/roles';
import type { Viewer } from '@/core/auth/roles';

const owner: Viewer = { id: 'u-owner', globalRole: 'OWNER', projects: {} };
const admin: Viewer = { id: 'u-admin', globalRole: 'ADMIN', projects: {} };
const researcher: Viewer = {
  id: 'u-res',
  globalRole: 'MEMBER',
  projects: { 'p-core': ['RESEARCHER'] },
};
const developer: Viewer = {
  id: 'u-dev',
  globalRole: 'MEMBER',
  projects: { 'p-core': ['DEVELOPER'], 'p-edge': ['DEVELOPER'] },
};
const both: Viewer = { id: 'u-both', globalRole: 'MEMBER', projects: { 'p-core': ['RESEARCHER', 'DEVELOPER'] } };

describe('panel roles', () => {
  it('has exactly one kind of owner', () => {
    expect(isOwner(owner)).toBe(true);
    expect(isOwner(admin)).toBe(false);
    expect(isAdmin(admin)).toBe(true);
    expect(isAdmin(researcher)).toBe(false);
  });

  it('lets an owner and an admin hand out roles at their level and below, never owner', () => {
    expect(assignableGlobalRoles(owner)).toEqual(['ADMIN', 'MEMBER']);
    expect(assignableGlobalRoles(admin)).toEqual(['ADMIN', 'MEMBER']);
    expect(assignableGlobalRoles(researcher)).toEqual([]);
  });

  it('never reassigns the owner, and never lets someone change their own role', () => {
    expect(canChangeGlobalRole(admin, { id: 'x', globalRole: 'OWNER' })).toBe(false);
    expect(canChangeGlobalRole(admin, { id: admin.id, globalRole: 'ADMIN' })).toBe(false);
    expect(canChangeGlobalRole(admin, { id: 'x', globalRole: 'MEMBER' })).toBe(true);
  });

  it('keeps the panel itself to the owner', () => {
    expect(canManagePanel(owner)).toBe(true);
    expect(canManagePanel(admin)).toBe(false);
    expect(canManageUsers(admin)).toBe(true);
    expect(canAssignProjectRoles(researcher)).toBe(false);
  });
});

describe('project access', () => {
  it('shows a member only the projects they belong to', () => {
    expect(visibleProjectIds(developer, ['p-core', 'p-edge', 'p-web'])).toEqual(['p-core', 'p-edge']);
    expect(canSeeProject(developer, 'p-web')).toBe(false);
  });

  it('shows an admin everything', () => {
    expect(visibleProjectIds(admin, ['p-core', 'p-web'])).toEqual(['p-core', 'p-web']);
    expect(canSeeProject(admin, 'p-web')).toBe(true);
  });

  it('gives one person more than one role in a project', () => {
    expect(hasProjectRole(both, 'p-core', 'RESEARCHER')).toBe(true);
    expect(hasProjectRole(both, 'p-core', 'DEVELOPER')).toBe(true);
  });
});

describe('who may run which track', () => {
  it('gives the research track to researchers and the delivery track to developers', () => {
    expect(canRunTrack(researcher, 'p-core', 'research')).toBe(true);
    expect(canRunTrack(researcher, 'p-core', 'delivery')).toBe(false);
    expect(canRunTrack(developer, 'p-core', 'delivery')).toBe(true);
    expect(canRunTrack(developer, 'p-core', 'research')).toBe(false);
  });

  it('maps every gate to the track that owns it', () => {
    for (const gate of ['intake', 'research', 'validate', 'publish'] as const) {
      expect(canRunGate(researcher, 'p-core', gate), gate).toBe(true);
      expect(canRunGate(developer, 'p-core', gate), gate).toBe(false);
    }
    for (const gate of ['pull', 'plan', 'implement', 'verify', 'ship'] as const) {
      expect(canRunGate(developer, 'p-core', gate), gate).toBe(true);
      expect(canRunGate(researcher, 'p-core', gate), gate).toBe(false);
    }
  });

  it('refuses a project the person is not in, whatever their role there would be', () => {
    expect(canRunTrack(researcher, 'p-edge', 'research')).toBe(false);
    expect(canRunGate(developer, 'p-web', 'ship')).toBe(false);
  });

  it('lets an admin run anything, which is what makes them an admin', () => {
    expect(canRunTrack(admin, 'p-anything', 'research')).toBe(true);
    expect(canRunGate(owner, 'p-anything', 'ship')).toBe(true);
  });
});
