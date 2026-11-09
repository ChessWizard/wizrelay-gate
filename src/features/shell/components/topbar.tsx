import Link from 'next/link';
import type { ReactNode } from 'react';
import type { GlobalRole } from '@/core/auth/roles';
import type { SignedInUser } from '@/services/auth/session';
import type { Translator } from '@/shared/i18n/translate';
import { Icon } from '@/shared/ui/icons';
import { HubSwitch } from './hub-switch';
import { LanguageSwitch } from './language-switch';
import { SearchBox } from './search-box';
import { UserMenu } from './user-menu';

/**
 * The bar across the top: where you are on the left, what you can do on the right.
 *
 * The middle is the search box, given room rather than squeezed between controls — it is
 * the one control on this bar somebody uses every day, and it now opens a list of its own
 * rather than quietly rearranging the page behind it.
 *
 * The member count used to sit here as a shortcut into administration. People have their
 * own page in the rail now, so a second way in was two things to keep in step and one
 * more object on a bar whose whole job is to stay quiet.
 */
export function Topbar({
  t,
  user,
  role,
  hubs,
  activeHubId,
  needsYou,
  crumbs,
}: {
  t: Translator;
  user: SignedInUser;
  role: GlobalRole;
  hubs: { id: string; name: string }[];
  activeHubId: string | null;
  needsYou: number;
  crumbs?: ReactNode;
}) {
  return (
    <header className="topbar">
      <div className="topbar-where">
        <HubSwitch hubs={hubs} activeId={activeHubId} />
        {crumbs ? <span className="crumbs">{crumbs}</span> : null}
      </div>

      <div className="topbar-find">
        <SearchBox />
      </div>

      <div className="topbar-acts">
        {needsYou > 0 ? (
          <Link className="needs" href="/#needs">
            <Icon name="waiting" />
            <span className="needs-label">{t('top.needsYou')}</span>
            <span className="n">{needsYou}</span>
          </Link>
        ) : null}
        <span className="topbar-rule" aria-hidden="true" />
        <LanguageSwitch />
        <UserMenu name={user.name} email={user.email} role={role} />
      </div>
    </header>
  );
}
