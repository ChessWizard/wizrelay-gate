import type { Actor } from '@/core/identity/actor';
import { actorTone, initials } from '@/core/identity/actor';

/** A person, as an avatar. */
export function ActorAvatar({ actor, size = 'default' }: { actor: Actor; size?: 'sm' | 'default' }) {
  return (
    <span
      className={size === 'sm' ? 'av av-sm' : 'av'}
      data-tone={actorTone(actor)}
      title={actor.name}
    >
      {initials(actor)}
    </span>
  );
}
