'use client';

import { useActionState, useEffect, useRef, useState, useTransition } from 'react';
import { useTranslator } from '@/shared/i18n/provider';
import { Banner, Button, Row } from '@/shared/ui/primitives';
import { Icon } from '@/shared/ui/icons';
import { ConfirmButton } from '@/shared/ui/confirm';
import { DropField } from '@/shared/ui/drop-field';
import { clearBrandImage, saveBrandImage, savePanelName } from '../actions';
import type { ActionResult } from '../actions';

type Kind = 'logo' | 'favicon';

/**
 * One image, chosen and then confirmed.
 *
 * Nothing is uploaded on picking a file: the browser renders it straight from disk, and
 * only a yes sends it. A picture is the one kind of setting where seeing it is the whole
 * check, so the preview comes first and the save button only exists while there is
 * something new to look at.
 */
function BrandImage({
  kind,
  label,
  current,
}: {
  kind: Kind;
  label: string;
  current: string | null;
}) {
  const t = useTranslator();
  const [clearing, startClear] = useTransition();
  const [preview, setPreview] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const form = useRef<HTMLFormElement | null>(null);

  const discard = () => {
    setPreview(null);
    setPicked(null);
    form.current?.reset();
  };

  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    async (previous, formData) => {
      const result = await saveBrandImage(previous, formData);
      if (result.ok) discard();
      return result;
    },
    null,
  );

  useEffect(() => {
    return () => {
      if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const onFile = (chosen: File | null) => {
    setPicked(chosen?.name ?? null);
    setPreview(chosen ? URL.createObjectURL(chosen) : null);
  };

  const shown = preview ?? current;
  const staged = preview !== null;

  return (
    <form action={action} className="brand-card" ref={form}>
      <input type="hidden" name="kind" value={kind} />

      <div className="brand-card-head">
        <div className={`brand-shot${staged ? ' is-staged' : ''}`}>
          {shown ? (

            <img src={shown} alt="" />
          ) : (
            <Icon name="image" size={20} />
          )}
        </div>
        <div className="stack" style={{ gap: '2px', minWidth: 0 }}>
          <span className="label">{label}</span>
          <span className="xs t3">
            {staged ? t('setup.imagePreview') : current ? t('setup.current') : t('setup.imageNone')}
          </span>
        </div>
        {current && !staged ? (
          <ConfirmButton
            label=""
            confirmLabel={t('common.remove')}
            disabled={clearing}
            onConfirm={async () => {
              startClear(() => void clearBrandImage(kind));
            }}
          />
        ) : null}
      </div>

      <DropField
        name="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon"
        hint={t('setup.imageTypes')}
        chosen={picked}
        onPick={onFile}
      />

      {state?.errorKey ? (
        <Banner tone="error" inline title={t(state.errorKey as 'error.forbidden')} />
      ) : null}

      {staged ? (
        <Row wrap gap={8}>
          <Button type="submit" variant="primary" size="sm" icon="upload" disabled={pending}>
            {t('setup.imageUse')}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={discard}>
            {t('common.cancel')}
          </Button>
        </Row>
      ) : null}
    </form>
  );
}

export function PanelForm({
  name,
  description,
  logoUrl,
  faviconUrl,
}: {
  name: string;
  description: string | null;
  logoUrl: string | null;
  faviconUrl: string | null;
}) {
  const t = useTranslator();
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    savePanelName,
    null,
  );

  return (
    <div className="stack" style={{ gap: 'var(--space-4)' }}>

      <form action={action} className="stack panel-copy" style={{ gap: 'var(--space-3)' }}>
        <div className="field">
          <label htmlFor="panel-name">{t('setup.panelName')}</label>
          <input id="panel-name" name="name" className="input" defaultValue={name} />
          <span className="help">{t('setup.panelNameHelp')}</span>
        </div>

        <div className="field">
          <label htmlFor="panel-description">{t('setup.panelDescription')}</label>
          <textarea
            id="panel-description"
            name="description"
            className="input textarea"
            rows={2}
            maxLength={300}
            defaultValue={description ?? ''}
            placeholder={t('auth.subtitle')}
          />
          <span className="help">{t('setup.panelDescriptionHelp')}</span>
        </div>

        <Row wrap gap={10}>
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? t('common.loading') : t('setup.saveCopy')}
          </Button>
          {state?.ok ? (
            <Row gap={6}>
              <Icon name="passed" className="ink-passed" />
              <span className="xs ink-passed">{t('settings.saved')}</span>
            </Row>
          ) : null}
        </Row>
      </form>

      <div className="brand-pair">
        <BrandImage kind="logo" label={t('setup.logo')} current={logoUrl} />
        <BrandImage kind="favicon" label={t('setup.favicon')} current={faviconUrl} />
      </div>

      <span className="help">{t('setup.imageHelp')}</span>
    </div>
  );
}
