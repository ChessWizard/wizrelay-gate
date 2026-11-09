'use client';

import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { Locale } from './config';
import type { Translator } from './translate';
import { createTranslator } from './translate';

const LocaleContext = createContext<Locale>('en');

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useLocale(): Locale {
  return useContext(LocaleContext);
}

export function useTranslator(): Translator {
  const locale = useLocale();
  return useMemo(() => createTranslator(locale), [locale]);
}
