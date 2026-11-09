import { describe, expect, it } from 'vitest';
import type { Actor } from '@/core/identity/actor';
import { actorTone, initials, sameActor, UNKNOWN_ACTOR } from '@/core/identity/actor';

const claude: Actor = {
  id: 'isa@example.com',
  name: 'İlknur Şahin',
  email: 'isa@example.com',
  source: 'claude',
};

describe('initials', () => {
  it('takes the first and last word of a name', () => {
    expect(initials({ name: 'İlknur Şahin' })).toBe('İŞ');
    expect(initials({ name: 'Ada Byron Lovelace' })).toBe('AL');
  });

  it('falls back to the first two letters of a single word', () => {
    expect(initials({ name: 'ada' })).toBe('AD');
  });

  it('splits a name written with dots or underscores', () => {
    expect(initials({ name: 'ada.lovelace' })).toBe('AL');
    expect(initials({ name: 'ada_lovelace' })).toBe('AL');
  });

  it('uses the email when there is no usable name', () => {
    expect(initials({ name: '', email: 'ops@example.com' })).toBe('OP');
  });

  it('never throws on an empty identity', () => {
    expect(initials({ name: '' })).toBe('?');
  });
});

describe('deciding two records are the same person', () => {
  it('matches on the identifier', () => {
    expect(sameActor(claude, { ...claude, name: 'different' })).toBe(true);
  });

  it('matches a git identity to a Claude identity by name, folded', () => {
    const git: Actor = {
      id: '1+dev@users.noreply.github.com',
      name: 'İLKNUR ŞAHİN',
      email: '1+dev@users.noreply.github.com',
      source: 'git',
    };
    expect(sameActor(claude, git)).toBe(true);
  });

  it('matches on the email even when the names differ', () => {
    const other: Actor = { id: 'other', name: 'Someone Else', email: 'ISA@example.com', source: 'git' };
    expect(sameActor(claude, other)).toBe(true);
  });

  it('keeps two different people apart', () => {
    const other: Actor = { id: 'ada@example.com', name: 'Ada Lovelace', source: 'git' };
    expect(sameActor(claude, other)).toBe(false);
  });

  it('links a sign-in name to the git name through an alias', () => {
    const signedIn: Actor = {
      id: 'chess@example.com',
      name: 'Night Owl',
      email: 'chess@example.com',
      source: 'claude',
      aliases: ['İlknur ŞAHİN', '1+dev@users.noreply.github.com'],
    };
    const committed: Actor = {
      id: '1+dev@users.noreply.github.com',
      name: 'İlknur ŞAHİN',
      email: '1+dev@users.noreply.github.com',
      source: 'git',
    };
    expect(sameActor(signedIn, committed)).toBe(true);
    expect(sameActor(committed, signedIn)).toBe(true);
  });

  it('does not link someone the aliases do not name', () => {
    const signedIn: Actor = { ...claude, aliases: ['Ada Lovelace'] };
    const third: Actor = { id: 'grace@example.com', name: 'Grace Hopper', source: 'git' };
    expect(sameActor(signedIn, third)).toBe(false);
  });
});

describe('the avatar tone', () => {
  it('is stable for one identity', () => {
    expect(actorTone(claude)).toBe(actorTone({ ...claude }));
  });

  it('is one of the six chart colours', () => {
    for (const id of ['a', 'bb', 'isa@example.com', 'ada@example.com', UNKNOWN_ACTOR.id]) {
      const tone = actorTone({ id });
      expect(tone).toBeGreaterThanOrEqual(1);
      expect(tone).toBeLessThanOrEqual(6);
    }
  });
});
