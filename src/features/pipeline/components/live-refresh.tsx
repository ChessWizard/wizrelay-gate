'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslator } from '@/shared/i18n/provider';

/**
 * Keeps a list screen current while work is in flight.
 *
 * A gate's own console streams over SSE, but the board shows many gates at once and a
 * stream per relay would be a connection per row. Instead the server says whether anything
 * is live, and only then does this refresh — so an idle board makes no requests at all,
 * and a busy one catches up every few seconds. The indicator is there so the motion on
 * screen is explained rather than mysterious.
 */
export function LiveRefresh({ live, intervalMs = 4_000 }: { live: boolean; intervalMs?: number }) {
  const router = useRouter();
  const t = useTranslator();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!live) return;
    if (typeof document !== 'undefined' && document.hidden) return;

    const timer = setInterval(() => {
      if (document.hidden) return;
      setTick((value) => value + 1);
      router.refresh();
    }, intervalMs);

    return () => clearInterval(timer);
  }, [intervalMs, live, router]);

  if (!live) return null;

  return (
    <span className="live-tag" role="status" data-tick={tick}>
      <span className="live-dot" aria-hidden="true" />
      {t('flow.live')}
    </span>
  );
}
