import { notFound } from 'next/navigation';
import { prisma } from '@/services/db/client';
import { branding } from '@/services/panel/branding';
import { AuthScreen } from '@/features/auth/components/auth-screen';
import { InviteForm } from '@/features/auth/components/invite-form';

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const user = await prisma.user.findUnique({ where: { inviteToken: token } });
  if (!user) notFound();

  const brand = await branding();

  return (
    <AuthScreen
      brand={brand}
      titleKey="auth.invite.title"
      subtitleKey="auth.invite.subtitle"
      subtitleParams={{ panel: brand.name }}
    >
      <InviteForm token={token} email={user.email} />
    </AuthScreen>
  );
}
