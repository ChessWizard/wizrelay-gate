import en from './messages/en.json';
import tr from './messages/tr.json';
import type { Locale } from './config';
import { DEFAULT_LOCALE } from './config';

export type MessageKey = keyof typeof en;
type Messages = Record<string, string>;

const CATALOGUES: Record<Locale, Messages> = { en, tr };

export interface Translator {
  (key: MessageKey, params?: Record<string, string | number>): string;
  locale: Locale;
}

/**
 * Every user-visible string comes from a catalogue, and a catalogue entry is a whole
 * sentence with named holes — never a fragment joined in code, because Turkish inflects
 * where English does not.
 */
export function createTranslator(locale: Locale): Translator {
  const catalogue = CATALOGUES[locale] ?? CATALOGUES[DEFAULT_LOCALE];
  const fallback = CATALOGUES[DEFAULT_LOCALE];

  const translate = ((key: MessageKey, params?: Record<string, string | number>) => {
    const template = catalogue[key] ?? fallback[key] ?? String(key);
    if (!params) return template;
    return template.replace(/\{(\w+)\}/g, (match, name: string) =>
      name in params ? String(params[name]) : match,
    );
  }) as Translator;

  translate.locale = locale;
  return translate;
}

export function messageKeys(): string[] {
  return Object.keys(en);
}

export function catalogue(locale: Locale): Messages {
  return CATALOGUES[locale] ?? CATALOGUES[DEFAULT_LOCALE];
}

/**
 * Translate a key the services layer chose at runtime. The key is not known at compile
 * time, so it is validated here instead: an unknown key returns undefined rather than
 * printing itself into the UI.
 */
export function translateDynamic(
  translator: Translator,
  key: string | undefined,
  params?: Record<string, string | number>,
): string | undefined {
  if (!key) return undefined;
  if (!(key in en)) return undefined;
  return translator(key as MessageKey, params);
}
