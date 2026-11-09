'use client';

import { useActionState, useState } from 'react';
import { useTranslator } from '@/shared/i18n/provider';
import { cn } from '@/shared/lib/cn';
import { Button, Row } from '@/shared/ui/primitives';
import { saveHubSettings } from '../actions';
import type { ActionResult } from '../actions';

/**
 * The trackers wizrelay has an adapter for.
 *
 * Typed in, this field was a way to misspell `clickup` and get a hub that reads no task
 * ids at all. The list is the plugin's `plugin/trackers/` directory; `none` is a real
 * choice, for a team whose tasks do not live anywhere the panel can reach.
 */
const TRACKERS = ['clickup', 'github', 'jira', 'linear', 'azure-devops', 'none'] as const;

/**
 * What a hub is, after it is connected.
 *
 * Connecting one used to be the only moment these could be set: a branch typed once, a
 * tracker typed once, and a team that renamed `main` to `master` had no way to say so
 * except by removing the hub and all its projects with it.
 */
export function HubSettings({
  hubId,
  branch,
  branches,
  trackerType,
  trackerPrefix,
  localPath,
  offers,
}: {
  hubId: string;
  branch: string;
  /** What the remote has, read with `git ls-remote`. Empty when it could not be reached. */
  branches: string[];
  trackerType: string | null;
  trackerPrefix: string | null;
  /** A checkout of this hub on the panel's own machine, when there is one. */
  localPath: string | null;
  /** Hub checkouts the paired machines have reported, for filling the field in. */
  offers: { machine: string; path: string; sameHost: boolean }[];
}) {
  const t = useTranslator();
  const [path, setPath] = useState(localPath ?? '');
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    saveHubSettings,
    null,
  );

  return (
    <form action={action} className="hub-settings">
      <input type="hidden" name="hubId" value={hubId} />

      <div className="field">
        <label htmlFor={`hub-path-${hubId}`}>{t('hub.localPath')}</label>
        <input
          id={`hub-path-${hubId}`}
          name="localPath"
          className="input mono"
          value={path}
          placeholder="/Users/you/Repos/research-hub"
          onChange={(event) => setPath(event.target.value)}
        />
        <span className="help">{t('hub.localPathHelp')}</span>

        {offers.length > 0 ? (
          <div className="path-offers">
            <span className="label">{t('hub.reported')}</span>
            <ul>
              {offers.map((offer) => (
                <li key={`${offer.machine}:${offer.path}`}>
                  <button
                    type="button"
                    className={cn('path-offer', !offer.sameHost && 'is-elsewhere')}
                    disabled={!offer.sameHost}
                    title={offer.sameHost ? offer.path : t('hub.reportedElsewhere')}
                    onClick={() => setPath(offer.path)}
                  >
                    <span className="m">{offer.machine}</span>
                    <span className="p mono trunc">{offer.path}</span>
                  </button>
                  {!offer.sameHost ? (
                    <span className="xs t3">{t('hub.reportedElsewhere')}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <div className="field">
        <label htmlFor={`hub-branch-${hubId}`}>{t('hub.branch')}</label>
        {branches.length > 0 ? (
          <select
            id={`hub-branch-${hubId}`}
            name="branch"
            className="select mono"
            defaultValue={branches.includes(branch) ? branch : branches[0]}
          >
            {branches.map((candidate) => (
              <option key={candidate} value={candidate}>
                {candidate}
              </option>
            ))}
          </select>
        ) : (

          <input
            id={`hub-branch-${hubId}`}
            name="branch"
            className="input mono"
            defaultValue={branch}
            placeholder="main"
          />
        )}
        <span className="help">
          {branches.length > 0 ? t('hub.branchHelp') : t('hub.branchUnread')}
        </span>
      </div>

      <div className="field">
        <label htmlFor={`hub-tracker-${hubId}`}>{t('hub.tracker')}</label>
        <select
          id={`hub-tracker-${hubId}`}
          name="trackerType"
          className="select"
          defaultValue={trackerType ?? 'none'}
        >
          {TRACKERS.map((tracker) => (
            <option key={tracker} value={tracker}>
              {tracker}
            </option>
          ))}
        </select>
        <span className="help">{t('hub.trackerHelp')}</span>
      </div>

      <div className="field">
        <label htmlFor={`hub-prefix-${hubId}`}>{t('hub.prefix')}</label>
        <input
          id={`hub-prefix-${hubId}`}
          name="trackerPrefix"
          className="input mono"
          defaultValue={trackerPrefix ?? ''}
          placeholder="CU-"
        />
        <span className="help">{t('hub.prefixHelp')}</span>
      </div>

      <Row wrap gap={8} className="hub-settings-foot">
        <Button type="submit" size="sm" variant="primary" disabled={pending}>
          {pending ? t('common.loading') : t('common.save')}
        </Button>
        {state?.ok ? <span className="xs ink-passed">{t('settings.saved')}</span> : null}
        {state?.errorKey ? (
          <span className="xs ink-failed">{t(state.errorKey as 'error.forbidden')}</span>
        ) : null}
      </Row>
    </form>
  );
}
