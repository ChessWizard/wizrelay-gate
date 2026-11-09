import Link from 'next/link';
import type { ReactNode } from 'react';
import type { Translator } from '@/shared/i18n/translate';
import { cn } from '@/shared/lib/cn';
import { Icon, type IconName } from '@/shared/ui/icons';

/**
 * A labelled badge: what the value is, then the value.
 *
 * A bare `web` next to a bare `acme-web` told nobody which
 * was the role and which was the repository, so both carry their own word now. The label
 * is part of the badge rather than a sentence beside it, which keeps the pair readable
 * when several of them sit in a row.
 */
export function MetaBadge({
  icon,
  label,
  value,
  title,
  tone,
  href,
}: {
  icon: IconName;
  label: string;
  value: ReactNode;
  title?: string;
  tone?: 'warn';
  href?: string;
}) {
  const body = (
    <>
      <Icon name={icon} />
      <span className="mb-k">{label}</span>
      <span className="mb-v mono">{value}</span>
    </>
  );
  const className = cn('meta-badge', tone === 'warn' && 'is-warn', href && 'is-link');
  return href ? (
    <Link className={className} href={href} title={title}>
      {body}
    </Link>
  ) : (
    <span className={className} title={title}>
      {body}
    </span>
  );
}

/** `owner/name` reads as the repository it is; the row only has space for the name. */
export function shortRepo(repo: string): string {
  const slash = repo.lastIndexOf('/');
  return slash === -1 ? repo : repo.slice(slash + 1);
}

/**
 * The two badges a delivery track carries: which repository the work lands in, and which
 * role in the hub's catalogue this track plays. A repository the panel has not been given
 * is said so on the badge itself rather than only in the gate that fails because of it.
 */
export function TrackBadges({
  role,
  repo,
  connected,
  connectHref,
  t,
}: {
  role: string;
  repo?: string;
  /** Whether a working copy for this role is registered in the workspace. */
  connected?: boolean;
  connectHref?: string;
  t: Translator;
}) {
  return (
    <span className="track-badges">
      <MetaBadge
        icon="branch"
        label={t('track.project')}
        value={repo ? shortRepo(repo) : t('common.none')}
        title={repo}
        tone={connected === false ? 'warn' : undefined}
      />
      <MetaBadge icon="user" label={t('track.role')} value={role} />
      {connected === false ? (

        <Link className="meta-fix xs" href={connectHref ?? '/admin'}>
          <Icon name="warned" />
          {t('track.connectRepo')}
        </Link>
      ) : null}
    </span>
  );
}
