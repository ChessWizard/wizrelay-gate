'use client';

import { useTransition } from 'react';
import { LOCALES } from '@/shared/i18n/config';
import { useLocale, useTranslator } from '@/shared/i18n/provider';
import { cn } from '@/shared/lib/cn';
import { Row, Stack } from '@/shared/ui/primitives';
import { Segmented } from '@/shared/ui/controls';
import type { Direction, ThemeChoice } from '@/services/workspace/types';
import { setAppearance, setLocale } from '@/features/shell/actions';

/** Direction, theme and language — the three choices that change how everything reads. */
export function AppearanceControls({
  direction,
  theme,
}: {
  direction: Direction;
  theme: ThemeChoice;
}) {
  const t = useTranslator();
  const locale = useLocale();
  const [pending, start] = useTransition();

  return (
    <Stack gap={16}>
      <Stack gap={8}>
        <span className="label">{t('settings.direction')}</span>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px, 100%), 1fr))',
            gap: '12px',
          }}
        >
          {(['a', 'b'] as const).map((candidate) => (
            <button
              key={candidate}
              type="button"
              className={cn('opt', direction === candidate && 'is-on')}
              aria-pressed={direction === candidate}
              disabled={pending}
              onClick={() => start(() => void setAppearance(candidate, theme))}
            >
              <span className="radio" />
              <span>
                <span className="ot">{t(`settings.direction.${candidate}` as 'settings.direction.a')}</span>
                <span className="oc" style={{ display: 'block' }}>
                  {t(`settings.direction.${candidate}.note` as 'settings.direction.a.note')}
                </span>
              </span>
            </button>
          ))}
        </div>
      </Stack>

      <Row wrap gap={24}>
        <Stack gap={6}>
          <span className="label">{t('settings.theme')}</span>
          <Segmented
            label={t('settings.theme')}
            active={theme}
            onSelect={(id) => start(() => void setAppearance(direction, id as ThemeChoice))}
            options={[
              { id: 'light', label: t('settings.theme.light') },
              { id: 'dark', label: t('settings.theme.dark') },
              { id: 'system', label: t('settings.theme.system') },
            ]}
          />
        </Stack>
        <Stack gap={6}>
          <span className="label">{t('settings.language')}</span>
          <Segmented
            label={t('settings.language')}
            active={locale}
            onSelect={(id) => start(() => void setLocale(id as (typeof LOCALES)[number]))}
            options={LOCALES.map((candidate) => ({
              id: candidate,
              label: candidate === 'en' ? 'English' : 'Türkçe',
            }))}
          />
        </Stack>
      </Row>
    </Stack>
  );
}
