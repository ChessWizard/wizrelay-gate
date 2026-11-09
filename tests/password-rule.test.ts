import { describe, expect, it } from 'vitest';
import { PASSWORD_MIN, checkPassword, passwordChecks } from '@/core/auth/password-rule';
import { catalogue } from '@/shared/i18n/translate';

/**
 * One rule, in one place.
 *
 * It used to be a server-side function nobody could see until they had already submitted,
 * and the screen's own hint named only the first requirement. Now the screen renders this
 * array while somebody types and the server checks the same array before storing
 * anything, so the two cannot disagree — these keep it that way.
 */
describe('the password rule', () => {
  it('names every requirement, in the order they are shown', () => {
    expect(passwordChecks('').map((check) => check.key)).toEqual([
      'auth.rule.length',
      'auth.rule.letter',
      'auth.rule.digit',
    ]);
  });

  it('has a sentence for every requirement in both languages', () => {
    for (const locale of ['tr', 'en'] as const) {
      const messages = catalogue(locale);
      for (const check of passwordChecks('')) {
        expect(messages[check.key], `${locale} ${check.key}`).toBeTruthy();
      }
    }
  });

  it('accepts a password that meets all of them', () => {
    expect(checkPassword('correct-horse-7')).toEqual({ ok: true });
    expect(passwordChecks('correct-horse-7').every((check) => check.met)).toBe(true);
  });

  it('reports the first requirement that fails', () => {
    expect(checkPassword('short1')).toEqual({ ok: false, reasonKey: 'auth.rule.length' });
    expect(checkPassword('123456789012')).toEqual({ ok: false, reasonKey: 'auth.rule.letter' });
    expect(checkPassword('abcdefghijkl')).toEqual({ ok: false, reasonKey: 'auth.rule.digit' });
  });

  it('counts a password of exactly the minimum as long enough', () => {
    const exact = `a${'1'.repeat(PASSWORD_MIN - 1)}`;
    expect(exact).toHaveLength(PASSWORD_MIN);
    expect(checkPassword(exact)).toEqual({ ok: true });
  });
});
