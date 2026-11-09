'use client';

import { useRouter } from 'next/navigation';
import type { GateId } from '@/core/gates/gates';
import { useTranslator } from '@/shared/i18n/provider';
import { Segmented } from '@/shared/ui/controls';

/** The fan-out switch: one delivery track per role, and this picks which one is shown. */
export function RoleSwitch({
  relayId,
  gate,
  roles,
  active,
}: {
  relayId: string;
  gate: GateId;
  roles: { role: string; repo?: string }[];
  active: string;
}) {
  const router = useRouter();
  const t = useTranslator();

  return (
    <Segmented
      label={t('run.role')}
      active={active}
      onSelect={(role) => router.push(`/relay/${relayId}?role=${role}&gate=${gate}`)}
      options={roles.map((item) => ({
        id: item.role,
        label: item.repo ? `${item.role} · ${item.repo}` : item.role,
      }))}
    />
  );
}
