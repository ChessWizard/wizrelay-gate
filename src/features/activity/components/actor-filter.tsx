'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslator } from '@/shared/i18n/provider';
import { cn } from '@/shared/lib/cn';
import { initials, actorTone } from '@/core/identity/actor';

/**
 * Whose work to read.
 *
 * Buttons rather than a dropdown: the list is the handful of people who have actually
 * done something, and a filter you can see the whole of is one you use. It writes into
 * the URL, so a filtered log is a link and the back button undoes it.
 */
export function ActorFilter({
  actors,
  active,
}: {
  actors: { id: string; name: string }[];
  active: string | null;
}) {
  const t = useTranslator();
  const router = useRouter();
  const params = useSearchParams();

  if (actors.length === 0) return null;

  const go = (id: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (id) next.set('who', id);
    else next.delete('who');
    // A new filter starts at the top; a cursor from the old one means nothing here.
    next.delete('before');
    const query = next.toString();
    router.replace(`/activity${query ? `?${query}` : ''}`, { scroll: false });
  };

  return (
    <div className="actor-filter" role="group" aria-label={t('activity.who')}>
      <button
        type="button"
        className={cn('actor-chip', !active && 'is-on')}
        aria-pressed={!active}
        onClick={() => go(null)}
      >
        {t('activity.everyone')}
      </button>
      {actors.map((actor) => (
        <button
          key={actor.id}
          type="button"
          className={cn('actor-chip', active === actor.id && 'is-on')}
          aria-pressed={active === actor.id}
          onClick={() => go(actor.id)}
        >
          <span className="av av-sm" data-tone={actorTone({ id: actor.id })} aria-hidden="true">
            {initials({ name: actor.name })}
          </span>
          <span className="trunc">{actor.name}</span>
        </button>
      ))}
    </div>
  );
}
