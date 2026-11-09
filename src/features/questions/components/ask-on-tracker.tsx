'use client';

import { useState, useTransition } from 'react';
import { useTranslator } from '@/shared/i18n/provider';
import { Button } from '@/shared/ui/primitives';
import { Icon } from '@/shared/ui/icons';
import { askOnTrackerAction } from '../actions';

/**
 * Put the question on the card.
 *
 * The answer to a research question is usually in somebody's head, and that somebody is
 * on the card rather than in this panel. One button rather than a form: everything the
 * comment needs — who it is for, what is being asked, which task — the panel already
 * knows, and a dialog asking a person to retype it would only be a way of losing them.
 */
export function AskOnTracker({
  relayId,
  questionId,
  posted,
}: {
  relayId: string;
  questionId: string;
  posted: boolean;
}) {
  const t = useTranslator();
  const [pending, start] = useTransition();
  const [state, setState] = useState<{ ok?: boolean; errorKey?: string } | null>(null);

  if (posted || state?.ok) {
    return (
      <span className="chip s-passed">
        <Icon name="check" />
        {t('questions.asked')}
      </span>
    );
  }

  return (
    <div className="stack" style={{ gap: '4px', alignItems: 'flex-start' }}>
      <Button
        size="sm"
        icon="external"
        disabled={pending}
        onClick={() =>
          start(async () => setState(await askOnTrackerAction(relayId, questionId)))
        }
      >
        {t('questions.askOnTracker')}
      </Button>
      {state?.errorKey ? (
        <span className="xs ink-failed">{t(state.errorKey as 'questions.askFailed')}</span>
      ) : (
        <span className="xs t3">{t('questions.askOnTrackerHelp')}</span>
      )}
    </div>
  );
}
