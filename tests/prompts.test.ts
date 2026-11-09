import { describe, expect, it } from 'vitest';
import { answerIn, gatePrompt, withNotes } from '@/core/gates/prompts';
import type { GATE_IDS } from '@/core/gates/gates';

/**
 * The language a session works in.
 *
 * The console is read by whoever pressed the button. A session thinking out loud in
 * English in front of somebody working in Turkish is harder to follow and slower to
 * correct — and it quietly decides that the panel's two languages are one language and a
 * translation of it.
 */
describe('the prompt a gate is opened with', () => {
  it('is the slash command, first, so Claude Code recognises it', () => {
    for (const locale of ['tr', 'en'] as const) {
      expect(gatePrompt('plan', locale)?.startsWith('/wizrelay:plan')).toBe(true);
      expect(gatePrompt('verify', locale)?.startsWith('/wizrelay:verify')).toBe(true);
    }
  });

  it('carries the language on its own line, after the command', () => {
    const prompt = gatePrompt('plan', 'tr') ?? '';
    const [first, blank, ...rest] = prompt.split('\n');
    expect(first).toBe('/wizrelay:plan');
    expect(blank).toBe('');
    expect(rest.join('\n')).toBe(answerIn('tr'));
  });

  it('writes the prose prompts in the language, not only the instruction', () => {
    const tr = gatePrompt('research', 'tr') ?? '';
    const en = gatePrompt('research', 'en') ?? '';
    expect(tr).toContain('Araştırma paketini');
    expect(en).toContain('Draft the research package');
    expect(tr).not.toBe(en);
  });

  it('asks for Turkish reasoning, not only a Turkish answer', () => {
    // A session that reasons in English and translates its last line is the failure this
    // is meant to prevent: the console is the thinking, not the summary.
    expect(answerIn('tr')).toContain('düşündüklerini');
  });

  it('has something to say for every gate that opens a session', () => {
    const conversational = ['research', 'plan', 'implement', 'verify', 'validate', 'intake', 'publish'];
    for (const gate of conversational) {
      expect(gatePrompt(gate as (typeof GATE_IDS)[number], 'tr'), gate).toBeTruthy();
    }
  });

  it('says nothing for a gate the panel has no prompt for', () => {
    expect(gatePrompt('pull', 'tr')).toBeNull();
  });
});

describe('a note somebody typed', () => {
  it('is appended as its own paragraph', () => {
    expect(withNotes('/wizrelay:plan', 'önbelleği değiştirme')).toBe(
      '/wizrelay:plan\n\nönbelleği değiştirme',
    );
  });

  it('changes nothing when there is no note', () => {
    expect(withNotes('/wizrelay:plan', undefined)).toBe('/wizrelay:plan');
    expect(withNotes('/wizrelay:plan', '   ')).toBe('/wizrelay:plan');
  });
});
