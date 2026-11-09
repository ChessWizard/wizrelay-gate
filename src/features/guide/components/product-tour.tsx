'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { useTranslator } from '@/shared/i18n/provider';
import { Button } from '@/shared/ui/primitives';

const SEEN = 'wizrelay-gate.tour';

const STOPS = [
  { selector: '[data-tour="nav"]', titleKey: 'tour.nav.title', bodyKey: 'tour.nav.body' },
  { selector: '[data-tour="todo"]', titleKey: 'tour.todo.title', bodyKey: 'tour.todo.body' },
  { selector: '[data-tour="needs"]', titleKey: 'tour.needs.title', bodyKey: 'tour.needs.body' },
  { selector: '[data-tour="relays"]', titleKey: 'tour.relays.title', bodyKey: 'tour.relays.body' },
  { selector: '[data-tour="user"]', titleKey: 'tour.user.title', bodyKey: 'tour.user.body' },
];

function read(): boolean {
  try {
    return window.localStorage.getItem(SEEN) === 'done';
  } catch {
    return true;
  }
}

export function ProductTour({ auto }: { auto: boolean }) {
  const t = useTranslator();
  const [visible, setVisible] = useState(false);
  const started = useRef(false);

  const run = useCallback(() => {
    const steps = STOPS.filter((stop) => document.querySelector(stop.selector)).map((stop) => ({
      element: stop.selector,
      popover: {
        title: t(stop.titleKey as 'tour.nav.title'),
        description: t(stop.bodyKey as 'tour.nav.body'),
      },
    }));
    if (steps.length === 0) return;

    driver({
      showProgress: true,
      nextBtnText: t('guide.next'),
      prevBtnText: t('guide.back'),
      doneBtnText: t('guide.done'),
      steps,
      onDestroyed: () => {
        try {
          window.localStorage.setItem(SEEN, 'done');
        } catch {
        }
      },
    }).drive();
  }, [t]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const seen = read();
    setVisible(true);
    if (auto && !seen) run();
  }, [auto, run]);

  if (!visible) return null;

  return (
    <Button size="sm" variant="ghost" icon="questions" onClick={run}>
      {t('guide.start')}
    </Button>
  );
}
