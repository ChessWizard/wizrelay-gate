'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { GateId } from '@/core/gates/gates';
import { useTranslator } from '@/shared/i18n/provider';
import { Icon } from '@/shared/ui/icons';

const KEY = 'wizrelay.follow';

/**
 * The choice lives in this browser, which makes it external state as far as React is
 * concerned: the server cannot know it, so rendering it as ordinary state would mean the
 * server says "following" and the client immediately disagrees. `useSyncExternalStore`
 * is the one API that says so honestly — the server snapshot is the default, the client
 * reads the real answer, and the difference is a re-render rather than a mismatch.
 */
const listeners = new Set<() => void>();

function readChoice(): boolean {
  try {
    return window.localStorage.getItem(KEY) !== 'off';
  } catch {
    return true;
  }
}

function writeChoice(value: boolean): void {
  try {
    window.localStorage.setItem(KEY, value ? 'on' : 'off');
  } catch {
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Follow the work to whichever gate is running.
 *
 * A pipeline is watched one gate at a time, and the gate that matters is the one moving.
 * Without this, watching a nine-gate track means noticing that a dot changed colour and
 * clicking across — which is how people end up staring at a finished gate while the next
 * one does the interesting part.
 *
 * It is on by default and it is a toggle, because following is wrong exactly when
 * somebody is reading something: a person scrolling back through an earlier gate's
 * transcript does not want the page to move under them. Turning it off is remembered in
 * this browser only — it is a preference about a screen, not a fact about the work.
 */
export function FollowRun({
  relayId,
  role,
  running,
}: {
  relayId: string;
  role?: string;
  /** The gate that is moving right now, or null when nothing is. */
  running: GateId | null;
}) {
  const t = useTranslator();
  const router = useRouter();
  const pathname = usePathname();
  const following = useSyncExternalStore(subscribe, readChoice, () => true);

  useEffect(() => {
    if (!following || !running) return;
    const target = `/relay/${relayId}/gate/${running}/console`;
    if (pathname === target) return;
    router.push(`${target}${role ? `?role=${encodeURIComponent(role)}` : ''}`);
  }, [following, running, relayId, role, pathname, router]);

  const toggle = () => writeChoice(!following);

  return (
    <button
      type="button"
      className={`follow ${following ? 'is-on' : ''}`}
      onClick={toggle}
      aria-pressed={following}
      title={t(following ? 'follow.onHelp' : 'follow.offHelp')}
    >
      <Icon name={following ? 'pulse' : 'dot'} />
      {t(following ? 'follow.on' : 'follow.off')}
    </button>
  );
}
