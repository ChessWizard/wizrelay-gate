import { redirect } from 'next/navigation';
import { currentSession } from '@/services/auth/session';
import { ensureOwner, panelState } from '@/services/auth/bootstrap';
import { branding } from '@/services/panel/branding';
import { AuthScreen } from '@/features/auth/components/auth-screen';
import { SignInForm } from '@/features/auth/components/sign-in-form';

export default async function LoginPage() {
  await ensureOwner();
  if (await currentSession()) redirect('/');

  const [brand, state] = await Promise.all([branding(), panelState()]);

  return (
    <AuthScreen brand={brand} titleKey="auth.title" subtitleKey="auth.subtitle">
      <SignInForm />
      {state.hasUsers ? null : <p className="sm t3">OWNER_EMAIL / OWNER_PASSWORD</p>}
    </AuthScreen>
  );
}
