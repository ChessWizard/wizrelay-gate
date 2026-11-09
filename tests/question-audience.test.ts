import { describe, expect, it } from 'vitest';
import {
  canSeeQuestion,
  isUnrouted,
  isWaitingOn,
  questionAudience,
} from '@/core/packages/audience';

const LEAD = 'lead@ornek.com';
const asked = (askedOf?: string[], askedBy?: string) => ({ askedOf, askedBy });

describe('who a question is addressed to', () => {
  it('is whoever it names', () => {
    const audience = questionAudience(asked(['ayse@ornek.com']), LEAD);
    expect(audience).toEqual({ to: ['ayse@ornek.com'], from: undefined, inherited: false });
  });

  it('falls to the research lead when it names nobody', () => {
    expect(questionAudience(asked(), LEAD)).toEqual({ to: [LEAD], from: undefined, inherited: true });
  });

  it('keeps the named addressee even where there is a lead', () => {
    expect(questionAudience(asked(['mert']), LEAD).to).toEqual(['mert']);
  });

  it('is unrouted when nobody is named and the project has no lead', () => {
    const audience = questionAudience(asked(), null);
    expect(audience.to).toEqual([]);
    expect(isUnrouted(audience)).toBe(true);
  });

  it('names somebody once however they were written', () => {
    expect(questionAudience(asked(['Ayse@Ornek.com', 'ayse@ornek.com']), LEAD).to).toEqual([
      'ayse@ornek.com',
    ]);
  });
});

describe('who may read it', () => {
  const audience = questionAudience(asked(['ayse@ornek.com'], 'isa@ornek.com'), LEAD);

  it('is the addressee', () => {
    expect(canSeeQuestion({ handle: 'ayse@ornek.com', administers: false }, audience)).toBe(true);
  });

  it('is the person who asked, who watches their own question', () => {
    expect(canSeeQuestion({ handle: 'isa@ornek.com', administers: false }, audience)).toBe(true);
  });

  it('is not somebody else on the same project', () => {
    expect(canSeeQuestion({ handle: 'mert@ornek.com', administers: false }, audience)).toBe(false);
  });

  it('is not the research lead once somebody was named', () => {
    expect(canSeeQuestion({ handle: LEAD, administers: false }, audience)).toBe(false);
  });

  it('is an admin, who administers the panel', () => {
    expect(canSeeQuestion({ handle: 'mert@ornek.com', administers: true }, audience)).toBe(true);
  });

  it('is nobody at all without a handle to compare', () => {
    expect(canSeeQuestion({ handle: '', administers: false }, audience)).toBe(false);
  });
});

describe('whose answer it is waiting on', () => {
  const audience = questionAudience(asked(['ayse@ornek.com'], 'isa@ornek.com'), LEAD);

  it('is the addressee, not the asker and not an admin reading it', () => {
    expect(isWaitingOn({ handle: 'ayse@ornek.com', administers: false }, audience)).toBe(true);
    expect(isWaitingOn({ handle: 'isa@ornek.com', administers: false }, audience)).toBe(false);
    expect(isWaitingOn({ handle: 'mert@ornek.com', administers: true }, audience)).toBe(false);
  });
});
