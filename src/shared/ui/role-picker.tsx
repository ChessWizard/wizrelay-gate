'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import type { ProjectRole } from '@/core/auth/roles';
import { PROJECT_ROLES } from '@/core/auth/roles';
import { useTranslator } from '@/shared/i18n/provider';
import { cn } from '@/shared/lib/cn';
import { Icon } from './icons';
import type { IconName } from './icons';

const ROLE_ICON: Record<ProjectRole, IconName> = {
  RESEARCHER: 'search',
  DEVELOPER: 'commit',
};

/**
 * Granting somebody a role in a project.
 *
 * There is one of these, and every screen that grants a role uses it: the invitation, the
 * person's own page, anywhere a role is handed out later. It used to be tick boxes in the
 * invitation and a different-looking row of buttons on the person page, so the same
 * decision looked like two unrelated things and neither looked considered.
 *
 * Each role is a card that says what it lets somebody do, because "Researcher" means
 * nothing to the person being invited on their first day. Off is a dashed outline — the
 * panel's way of saying "nothing here yet"; on is filled and ticked.
 *
 * `name` makes it a form control: the chosen roles are posted as that field, which is how
 * the invitation carries them. `onChange` makes it live, for a role changed in place.
 */
export function RolePicker({
  value,
  roles = PROJECT_ROLES,
  name,
  onChange,
  disabled,
  label,
}: {
  value: ProjectRole[];
  roles?: readonly ProjectRole[];
  name?: string;
  onChange?: (next: ProjectRole[]) => void;
  disabled?: boolean;
  label?: string;
}) {
  const t = useTranslator();
  const [local, setLocal] = useState<ProjectRole[]>(value);

  const chosen = name ? local : value;

  const toggle = (role: ProjectRole) => {
    const next = chosen.includes(role) ? chosen.filter((item) => item !== role) : [...chosen, role];
    if (name) setLocal(next);
    onChange?.(next);
  };

  return (
    <div className="role-pick" role="group" aria-label={label ?? t('people.projectRoles')}>
      {roles.map((role) => {
        const on = chosen.includes(role);
        return (
          <button
            key={role}
            type="button"
            className={cn('role-opt', on && 'is-on')}
            aria-pressed={on}
            disabled={disabled}
            onClick={() => toggle(role)}
          >
            <span className="role-opt-i" aria-hidden="true">
              <Icon name={ROLE_ICON[role]} />
            </span>
            <span className="role-opt-txt">
              <span className="role-opt-name">{t(`role.${role}` as 'role.RESEARCHER')}</span>
              <span className="role-opt-what">{t(`role.what.${role}` as 'role.what.RESEARCHER')}</span>
            </span>
            <span className="role-opt-tick" aria-hidden="true">
              <Icon name="check" />
            </span>
          </button>
        );
      })}
      {name
        ? chosen.map((role) => <input key={role} type="hidden" name={name} value={role} />)
        : null}
    </div>
  );
}

/**
 * The list of projects somebody may be given access to.
 *
 * Same rows on the invitation and on the person's page, so changing a role later looks
 * like making the decision in the first place.
 */
export function AccessList({ children }: { children: ReactNode }) {
  return <ul className="access-list">{children}</ul>;
}

export function AccessRow({
  role,
  hubName,
  children,
}: {
  role: string;
  hubName: string;
  children: ReactNode;
}) {
  return (
    <li className="access-row">
      <span className="access-who">
        <span className="mono sm trunc">{role}</span>
        <span className="xs t3 trunc">{hubName}</span>
      </span>
      {children}
    </li>
  );
}

/**
 * What somebody has, where there is no room to change it — a table row, a profile card.
 * It reads as the same decision in the same words, just not editable here.
 */
export function AccessSummary({
  granted,
}: {
  granted: { projectRole: string; roles: ProjectRole[] }[];
}) {
  const t = useTranslator();
  const held = granted.filter((entry) => entry.roles.length > 0);

  if (held.length === 0) return <span className="xs t3">{t('people.noAccess')}</span>;

  return (
    <span className="access-sum">
      {held.map((entry) => (
        <span className="access-tag" key={entry.projectRole}>
          <span className="mono">{entry.projectRole}</span>
          {entry.roles.map((role) => (
            <span className="access-tag-r" key={role} title={t(`role.${role}` as 'role.RESEARCHER')}>
              <Icon name={ROLE_ICON[role]} />
            </span>
          ))}
        </span>
      ))}
    </span>
  );
}
