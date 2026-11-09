'use client';

import { useState } from 'react';
import { useTranslator } from '@/shared/i18n/provider';
import { GlobChip } from './primitives';

/**
 * A scope, shown at a readable length.
 *
 * A real repository's allow list runs to dozens of globs, and printing all of them turns
 * the panel into a wall nobody reads — which is the same as hiding them. So the first few
 * are shown and the rest are one click away, with the count visible so it is obvious that
 * there are more. Deny globs are never hidden: they are the ones that stop a run.
 */
export function GlobList({
  allow,
  deny,
  initial = 10,
}: {
  allow: string[];
  deny: string[];
  initial?: number;
}) {
  const t = useTranslator();
  const [expanded, setExpanded] = useState(false);

  const shown = expanded ? allow : allow.slice(0, initial);
  const hidden = allow.length - shown.length;

  return (
    <div className="row wrap" style={{ gap: '4px' }}>
      {deny.map((pattern) => (
        <GlobChip key={`deny-${pattern}`} pattern={pattern} kind="deny" />
      ))}
      {shown.map((pattern) => (
        <GlobChip key={`allow-${pattern}`} pattern={pattern} kind="allow" />
      ))}
      {hidden > 0 || expanded ? (
        <button type="button" className="filter" onClick={() => setExpanded((value) => !value)}>
          {expanded ? t('scope.showLess') : t('scope.showMore', { count: hidden })}
        </button>
      ) : null}
    </div>
  );
}
