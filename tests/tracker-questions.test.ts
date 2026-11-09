import { describe, expect, it } from 'vitest';
import {
  alreadyPosted,
  postedQuestion,
  questionComment,
  repliesTo,
} from '@/core/tracker/questions';

const LINES = { askedBy: 'Soran', reply: 'Yanıtlamak için bu yoruma cevap verin.', task: 'Görev' };

const post = questionComment({
  questionId: 'Q-012',
  title: 'Hangi önbellek stratejisi?',
  body: 'Mevcut TTL 30 saniye.',
  to: ['ayse@ornek.com'],
  from: 'isa@ornek.com',
  relayId: 'CU-123',
  role: 'api',
  url: 'http://panel/questions',
  lines: LINES,
});

/**
 * The loop through the tracker.
 *
 * Everything here protects one thing: the panel's own comment must never be mistaken for
 * an answer to itself. That mistake would show the question as answered the instant it
 * was asked, which is worse than not asking.
 */
describe('the comment the panel posts', () => {
  it('opens with the addressee, so the tracker notifies them', () => {
    expect(post.split('\n')[0]).toBe('[wizrelay Q-012] @ayse@ornek.com');
  });

  it('carries the question, the asker and the task', () => {
    expect(post).toContain('Hangi önbellek stratejisi?');
    expect(post).toContain('Mevcut TTL 30 saniye.');
    expect(post).toContain('Soran: @isa@ornek.com');
    expect(post).toContain('Görev: CU-123 · api');
    expect(post).toContain('http://panel/questions');
  });

  it(`is recognisable as the panel own posting`, () => {
    expect(postedQuestion(post)).toBe('Q-012');
  });

  it('holds together with no body, no asker and no link', () => {
    const bare = questionComment({
      questionId: 'Q-1',
      title: 'Kısa soru',
      to: [],
      relayId: 'CU-9',
      lines: LINES,
    });
    expect(bare.split('\n')[0]).toBe('[wizrelay Q-1]');
    expect(bare).toContain('Kısa soru');
    expect(bare).not.toContain('Soran');
  });
});

describe('reading the replies back', () => {
  const comments = [
    { id: '1', text: post, user: 'wizrelay', at: '2026-11-08T10:00:00Z' },
    { id: '2', text: 'Q-012 için 30 saniye yeterli, değiştirmeyin.', user: 'Ayşe', at: '2026-11-08T11:00:00Z' },
    { id: '3', text: 'Başka bir konu hakkında', user: 'Mert', at: '2026-11-08T12:00:00Z' },
    { id: '4', text: 'q-012: ayrıca metrikleri de ekleyin', user: 'Ayşe', at: '2026-11-08T13:00:00Z' },
  ];

  it(`is every comment naming the question except the panel own`, () => {
    expect(repliesTo('Q-012', comments).map((reply) => reply.id)).toEqual(['2', '4']);
  });

  it('does not confuse a different question for this one', () => {
    expect(repliesTo('Q-1', comments)).toEqual([]);
  });

  it('knows the question has already been asked on the card', () => {
    expect(alreadyPosted('Q-012', comments)).toBe(true);
    expect(alreadyPosted('Q-013', comments)).toBe(false);
  });

  it('reads nothing out of an empty card', () => {
    expect(repliesTo('Q-012', [])).toEqual([]);
    expect(alreadyPosted('Q-012', [])).toBe(false);
  });
});
