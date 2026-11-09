'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslator } from '@/shared/i18n/provider';
import { Button, Row } from '@/shared/ui/primitives';
import { Icon } from '@/shared/ui/icons';

/**
 * Run the checks again, and say what came back.
 *
 * It used to refresh the page and nothing else: the checks below changed, or did not, and
 * the person who pressed it had no way to tell which. A command whose only feedback is
 * "the screen looks the same" teaches people to stop pressing it. So it reports the
 * count, the time, and whether anything is actually wrong.
 */
export function Diagnostics({
  passed,
  total,
  failed,
}: {
  passed: number;
  total: number;
  failed: number;
}) {
  const t = useTranslator();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [ranAt, setRanAt] = useState<string | null>(null);

  return (
    <Row wrap gap={8}>
      {ranAt ? (
        <Row gap={6}>
          <Icon
            name={failed > 0 ? 'failed' : 'passed'}
            className={failed > 0 ? 'ink-failed' : 'ink-passed'}
          />
          <span className="xs t3">
            {t('settings.doctorResult', { passed, total, at: ranAt })}
          </span>
        </Row>
      ) : null}
      <Button
        size="sm"
        icon="refresh"
        disabled={pending}
        onClick={() =>
          start(() => {
            router.refresh();
            setRanAt(new Date().toLocaleTimeString());
          })
        }
      >
        {t(pending ? 'settings.runningDoctor' : 'settings.runDoctor')}
      </Button>
    </Row>
  );
}
