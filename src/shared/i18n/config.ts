export const LOCALES = ['en', 'tr'] as const;
export type Locale = (typeof LOCALES)[number];

/** English is the default, as the project's documentation is. */
export const DEFAULT_LOCALE: Locale = 'en';

export function isLocale(value: string | undefined): value is Locale {
  return value === 'en' || value === 'tr';
}

export const LOCALE_LABEL: Record<Locale, string> = { en: 'EN', tr: 'TR' };
