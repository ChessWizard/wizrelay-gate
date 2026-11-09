import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LOCALES } from '@/shared/i18n/config';
import { catalogue, createTranslator, messageKeys } from '@/shared/i18n/translate';

const MESSAGES = join(process.cwd(), 'src/shared/i18n/messages');

function read(locale: string): Record<string, string> {
  return JSON.parse(readFileSync(join(MESSAGES, `${locale}.json`), 'utf8')) as Record<string, string>;
}

const PLACEHOLDER = /\{(\w+)\}/g;

function placeholders(value: string): string[] {
  return [...value.matchAll(PLACEHOLDER)].map((match) => match[1]).sort();
}

describe('the message catalogues', () => {
  const english = read('en');

  it.each(LOCALES)('%s has exactly the same keys as en', (locale) => {
    const other = read(locale);
    expect(Object.keys(other).sort()).toEqual(Object.keys(english).sort());
  });

  it.each(LOCALES)('%s uses the same placeholders in every string', (locale) => {
    const other = read(locale);
    for (const [key, value] of Object.entries(english)) {
      expect({ key, holes: placeholders(other[key]) }).toEqual({ key, holes: placeholders(value) });
    }
  });

  it('never leaves a string empty', () => {
    for (const locale of LOCALES) {
      for (const [key, value] of Object.entries(read(locale))) {
        expect(value.trim(), `${locale} ${key}`).not.toBe('');
      }
    }
  });

  it('has a key for every gate and every status', () => {
    const keys = new Set(messageKeys());
    for (const gate of ['intake', 'research', 'validate', 'publish', 'pull', 'plan', 'implement', 'verify', 'ship']) {
      expect(keys.has(`gate.${gate}`)).toBe(true);
    }
    for (const status of ['idle', 'running', 'waiting', 'handoff', 'passed', 'warned', 'failed', 'blocked', 'skipped']) {
      expect(keys.has(`status.${status}`)).toBe(true);
    }
  });
});

describe('the translator', () => {
  it('fills named holes', () => {
    const t = createTranslator('en');
    expect(t('prompt.step', { index: 1, total: 2 })).toBe('approval 1 of 2');
  });

  it('answers in Turkish when the locale is tr', () => {
    const t = createTranslator('tr');
    expect(t('status.waiting')).toBe('Seni bekliyor');
    expect(t('gate.verify')).toBe('Doğrulama');

    expect(t('gate.validate')).not.toBe(t('gate.verify'));
    expect(t('validate.title')).not.toBe(t('verify.title'));
  });

  it('keeps Validate and Verify distinguishable in Turkish', () => {
    const tr = catalogue('tr');
    expect(tr['gate.validate']).not.toBe(tr['gate.verify']);
  });

  it('leaves an unknown hole alone rather than printing undefined', () => {
    const t = createTranslator('en');
    expect(t('prompt.step', { index: 1 })).toBe('approval 1 of {total}');
  });
});

/**
 * The prompt languages and the panel's languages are the same list.
 *
 * `src/core/gates/prompts.ts` declares its own, because core answers to nothing above it.
 * Two lists that must agree and are written in two places drift, so this is where they
 * are held together: adding a language to the panel without a prompt for it would leave
 * sessions working in English for people who never chose it.
 */
describe('the languages a gate can be opened in', () => {
  it('are the panel languages, exactly', () => {
    const source = readFileSync('src/core/gates/prompts.ts', 'utf8');
    const declared = /export type PromptLocale = ([^;]+);/.exec(source)?.[1] ?? '';
    const names = [...declared.matchAll(/'([a-z-]+)'/g)].map((match) => match[1]).sort();
    expect(names).toEqual([...LOCALES].sort());
  });
});
