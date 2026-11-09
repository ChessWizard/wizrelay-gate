import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { currentSession } from '@/services/auth/session';
import { ensureOwner, panelState } from '@/services/auth/bootstrap';
import { getLocale } from '@/services/panel/locale';
import { I18nProvider } from '@/shared/i18n/provider';

export default async function AppLayout({ children }: { children: ReactNode }) {
  await ensureOwner();

  const session = await currentSession();
  if (!session) redirect('/login');

  const state = await panelState();
  if (!state.initialized && session.viewer.globalRole !== 'OWNER') redirect('/waiting');

  return <I18nProvider locale={await getLocale()}>{children}</I18nProvider>;
}
