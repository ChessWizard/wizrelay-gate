'use client';

import { useTransition } from 'react';
import { useTranslator } from '@/shared/i18n/provider';
import { setResearchLead } from '../actions';

export function ResearchLeadSelect({
  projectId,
  current,
  people,
}: {
  projectId: string;
  current: string | null;
  people: { id: string; name: string }[];
}) {
  const t = useTranslator();
  const [pending, start] = useTransition();

  return (
    <select
      className="select select-sm"
      value={current ?? ''}
      disabled={pending}
      aria-label={t('project.researchLead')}
      onChange={(event) => {
        const value = event.target.value || null;
        start(() => void setResearchLead(projectId, value));
      }}
    >
      <option value="">{t('common.none')}</option>
      {people.map((person) => (
        <option key={person.id} value={person.id}>
          {person.name}
        </option>
      ))}
    </select>
  );
}
