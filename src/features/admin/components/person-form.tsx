'use client';

import { useActionState, useState } from 'react';
import type { GlobalRole } from '@/core/auth/roles';
import { useTranslator } from '@/shared/i18n/provider';
import { Banner, Button, Row } from '@/shared/ui/primitives';
import { CopyButton } from '@/shared/ui/controls';
import { Hint } from '@/shared/ui/hint';
import { Modal } from '@/shared/ui/modal';
import { AccessList, AccessRow, RolePicker } from '@/shared/ui/role-picker';
import { addPerson } from '../actions';
import type { ActionResult } from '../actions';

export interface InvitableProject {
  id: string;
  /** The hub role this repository plays — `api`, `worker`. */
  role: string;
  hubName: string;
}

export function PersonForm({
  assignable,
  origin,
  projects,
}: {
  assignable: GlobalRole[];
  origin: string;
  projects: InvitableProject[];
}) {
  const t = useTranslator();
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(addPerson, null);

  const link = state?.ok && state.value ? `${origin}/invite/${state.value}` : null;

  return (
    <div className="stack" style={{ gap: 'var(--space-3)' }}>
      <Row wrap gap={10}>
        <Button variant="primary" icon="plus" onClick={() => setOpen(true)}>
          {t('people.invite')}
        </Button>
        <span className="xs t3">{t('people.inviteHelp')}</span>
      </Row>

      {link ? (
        <div className="inset stack" style={{ gap: '6px' }}>
          <span className="label">{t('people.inviteLink')}</span>
          <div className="row wrap" style={{ gap: '8px' }}>
            <code className="mono sm trunc grow">{link}</code>
            <CopyButton
              value={link}
              label={t('common.copy')}
              copiedLabel={t('common.copied')}
            />
          </div>
          <span className="help">{t('people.inviteLinkHelp')}</span>
        </div>
      ) : null}

      <Modal open={open} onClose={() => setOpen(false)} title={t('people.invite')}>
    <form
      action={(formData) => {
        action(formData);
        setOpen(false);
      }}
      className="stack"
      style={{ gap: 'var(--space-3)' }}
    >
      {state?.errorKey ? (
        <Banner tone="error" inline title={t(state.errorKey as 'error.forbidden')} />
      ) : null}

      <div className="invite-grid">
        <div className="field">
          <label htmlFor="person-email">
            {t('people.claudeRef')}{' '}
            <Hint title={t('people.claudeRef')}>{t('hint.claudeAccount')}</Hint>
          </label>
          <input id="person-email" name="email" type="email" className="input" required />
          <span className="help">{t('people.claudeRefHelp')}</span>
        </div>

        <div className="field">
          <label htmlFor="person-name">{t('people.name')}</label>
          <input id="person-name" name="name" className="input" />
        </div>

        <div className="field">
          <label htmlFor="person-role">
            {t('people.globalRole')} <Hint title={t('people.globalRole')}>{t('hint.panelRole')}</Hint>
          </label>
          <select id="person-role" name="globalRole" className="select" defaultValue="MEMBER">
            {assignable.map((role) => (
              <option key={role} value={role}>
                {t(`role.${role}` as 'role.ADMIN')}
              </option>
            ))}
          </select>
        </div>

      </div>

      <div className="field">
        <label>{t('people.projectAccess')}</label>
        <span className="help">{t('people.projectAccessHelp')}</span>
        {projects.length === 0 ? (
          <span className="sm t3">{t('project.none')}</span>
        ) : (
          <AccessList>
            {projects.map((project) => (
              <AccessRow key={project.id} role={project.role} hubName={project.hubName}>
                <RolePicker value={[]} name={`project:${project.id}`} />
              </AccessRow>
            ))}
          </AccessList>
        )}
      </div>

      <Row wrap gap={10}>
        <Button type="submit" variant="primary" icon="plus" disabled={pending}>
          {t('people.inviteCreate')}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          {t('common.cancel')}
        </Button>
      </Row>
    </form>
      </Modal>
    </div>
  );
}
