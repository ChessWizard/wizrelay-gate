import { redirect } from 'next/navigation';
import { currentSession } from '@/services/auth/session';
import { panelState } from '@/services/auth/bootstrap';
import { branding } from '@/services/panel/branding';
import { AuthScreen } from '@/features/auth/components/auth-screen';
import { SignOutButton } from '@/features/auth/components/sign-out-button';

export default async function WaitingPage() {
  const session = await currentSession();
  if (!session) redirect('/login');

  const state = await panelState();
  if (state.initialized || session.viewer.globalRole === 'OWNER') redirect('/');

  return (
    <AuthScreen
      brand={await branding()}
      titleKey="auth.waiting.title"
      subtitleKey="auth.waiting.body"
    >
      <SignOutButton />
    </AuthScreen>
  );
}
