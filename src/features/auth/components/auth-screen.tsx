import type { ReactNode } from 'react';
import { createTranslator } from '@/shared/i18n/translate';
import type { MessageKey } from '@/shared/i18n/translate';
import { I18nProvider } from '@/shared/i18n/provider';
import { getLocale } from '@/services/panel/locale';
import type { Branding } from '@/services/panel/branding';
import { Mark } from '@/shared/ui/icons';

/** The frame the signed-out screens share. */
export async function AuthScreen({
  brand,
  titleKey,
  subtitleKey,
  subtitleParams,
  children,
}: {
  brand: Branding;
  titleKey: MessageKey;
  subtitleKey: MessageKey;
  subtitleParams?: Record<string, string>;
  children: ReactNode;
}) {
  const locale = await getLocale();
  const t = createTranslator(locale);

  return (
    <I18nProvider locale={locale}>
      <main className="auth">
        <div className="auth-card">
          <div className="auth-brand">
            {brand.logoUrl ? (

              <img src={brand.logoUrl} alt="" className="auth-logo" />
            ) : (
              <Mark />
            )}
            <span className="auth-name">{brand.name}</span>
          </div>

          <div className="stack" style={{ gap: '4px' }}>
            <h1>{t(titleKey)}</h1>

            <p className="t2">{brand.description ?? t(subtitleKey, subtitleParams)}</p>
          </div>

          {children}
        </div>
      </main>
    </I18nProvider>
  );
}
