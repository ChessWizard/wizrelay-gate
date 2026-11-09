import { DEFAULT_LOCALE } from '@/shared/i18n/config';
import type { Locale } from '@/shared/i18n/config';
import { prisma } from '@/services/db/client';
import { currentSession } from '@/services/auth/session';

/** A person's own language, else the panel's, else the default. */
export async function getLocale(): Promise<Locale> {
  try {
    const session = await currentSession();
    if (session?.user.locale) return session.user.locale as Locale;
    const panel = await prisma.panel.findUnique({ where: { id: 'panel' } });
    if (panel?.locale) return panel.locale as Locale;
  } catch {
  }
  return DEFAULT_LOCALE;
}

/**
 * The language one person reads in, for work that outlives their request.
 *
 * `getLocale` reads the session, which a gate cannot: a run is started by a server action
 * and then continues on its own, often after the request that began it has gone. The
 * person is named instead, and the panel's own setting answers for a run nobody started
 * by hand.
 */
export async function localeFor(userId: string | null | undefined): Promise<Locale> {
  try {
    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { locale: true },
      });
      if (user?.locale) return user.locale as Locale;
    }
    const panel = await prisma.panel.findUnique({ where: { id: 'panel' } });
    if (panel?.locale) return panel.locale as Locale;
  } catch {
  }
  return DEFAULT_LOCALE;
}
