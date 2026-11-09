import type { ReactNode } from 'react';
import { createTranslator } from '@/shared/i18n/translate';
import { requireUser } from '@/services/auth/context';
import { getLocale } from '@/services/panel/locale';
import { branding } from '@/services/panel/branding';
import { activeContext } from '@/services/panel/active';
import { getRail } from '@/services/panel/rail';
import { prisma } from '@/services/db/client';
import { loadBoard } from '@/services/relays/service';
import { Nav } from './nav';
import { Topbar } from './topbar';

export async function AppShell({ children, crumbs }: { children: ReactNode; crumbs?: ReactNode }) {
  const [{ user, viewer }, locale, brand, context, rail] = await Promise.all([
    requireUser(),
    getLocale(),
    branding(),
    activeContext(),
    getRail(),
  ]);
  const t = createTranslator(locale);

  const [inbox, board] = await Promise.all([
    prisma.inboxItem.count({ where: { userId: user.id, readAt: null } }),
    context.hub ? loadBoard() : Promise.resolve(null),
  ]);

  const needsYou = board?.metrics.needsYou ?? 0;
  const openQuestions = board?.metrics.openQuestions ?? 0;

  return (
    <div className="shell app-root" data-rail={rail}>
      <Nav
        brand={brand}
        role={viewer.globalRole}
        needsYou={needsYou}
        openQuestions={openQuestions}
        inbox={inbox}
        rail={rail}
      />
      <div className="main">
        <Topbar
          t={t}
          user={user}
          role={viewer.globalRole}
          hubs={context.hubs.map((hub) => ({ id: hub.id, name: hub.name }))}
          activeHubId={context.hub?.id ?? null}
          needsYou={needsYou}
          crumbs={crumbs}
        />
        {children}
      </div>
    </div>
  );
}
