'use client';

import { useTransition } from 'react';
import type { GlobalRole, ProjectRole } from '@/core/auth/roles';
import { useTranslator } from '@/shared/i18n/provider';
import { RolePicker } from '@/shared/ui/role-picker';
import { setDisabled, setGlobalRole, setProjectRoles } from '../actions';

export function GlobalRoleSelect({
  userId,
  current,
  assignable,
  locked,
}: {
  userId: string;
  current: GlobalRole;
  assignable: GlobalRole[];
  locked: boolean;
}) {
  const t = useTranslator();
  const [pending, start] = useTransition();

  if (locked || assignable.length === 0) {
    return <span className="chip s-idle">{t(`role.${current}` as 'role.ADMIN')}</span>;
  }

  return (
    <select
      className="select select-sm"
      value={current}
      disabled={pending}
      aria-label={t('people.globalRole')}
      onChange={(event) => {
        const next = event.target.value as GlobalRole;
        start(() => void setGlobalRole(userId, next));
      }}
    >
      {assignable.map((role) => (
        <option key={role} value={role}>
          {t(`role.${role}` as 'role.ADMIN')}
        </option>
      ))}
    </select>
  );
}

export function ProjectRoleChips({
  userId,
  projectId,
  current,
}: {
  userId: string;
  projectId: string;
  current: ProjectRole[];
}) {
  const [pending, start] = useTransition();

  return (
    <RolePicker
      value={current}
      disabled={pending}
      onChange={(next) => start(() => void setProjectRoles(userId, projectId, next))}
    />
  );
}

export function DisableToggle({
  userId,
  disabled,
  locked,
}: {
  userId: string;
  disabled: boolean;
  locked: boolean;
}) {
  const t = useTranslator();
  const [pending, start] = useTransition();

  if (locked) return null;

  return (
    <button
      type="button"
      className="btn btn-sm btn-ghost"
      disabled={pending}
      onClick={() => start(() => void setDisabled(userId, !disabled))}
    >
      {disabled ? t('people.enable') : t('people.disable')}
    </button>
  );
}
