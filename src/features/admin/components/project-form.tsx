'use client';

import { useActionState, useEffect, useMemo, useState, useTransition } from 'react';
import { useTranslator } from '@/shared/i18n/provider';
import { Banner, Button } from '@/shared/ui/primitives';
import { Icon } from '@/shared/ui/icons';
import { cn } from '@/shared/lib/cn';
import { failureKey, listingState } from '@/core/integrations/repositories';
import type { Repository, RepositoryListing } from '@/services/integrations/github';
import { addProjectByUrl, githubRepositories } from '../actions';
import type { ActionResult } from '../actions';

/**
 * Giving a hub role a repository.
 *
 * There used to be three ways to do this: pick a folder on the panel's machine, paste a
 * clone URL, or type one for an agent to clone. On a shared panel the first describes a
 * filesystem no gate ever touches — the work happens on people's own machines — and the
 * other two are a line somebody has to copy correctly from somewhere else.
 *
 * There is one way now. The GitHub token is already connected, so the panel asks what it
 * can see and the person picks. Nothing is cloned here: the repository is recorded by its
 * URL, and whichever machine runs the gate is the machine that has it.
 */
export function ProjectForm({ hubId, roles }: { hubId: string; roles: string[] }) {
  const t = useTranslator();
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    addProjectByUrl,
    null,
  );

  const [listing, setListing] = useState<RepositoryListing | null>(null);
  const [loading, start] = useTransition();
  const [filter, setFilter] = useState('');
  const [picked, setPicked] = useState<Repository | null>(null);
  const [typed, setTyped] = useState('');
  const [byHand, setByHand] = useState(false);

  const load = () => start(async () => setListing(await githubRepositories()));

  useEffect(load, []);

  const shown = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    const list = listing?.repos ?? [];
    if (!needle) return list.slice(0, 40);
    return list
      .filter(
        (repo) =>
          repo.fullName.toLowerCase().includes(needle) ||
          (repo.description ?? '').toLowerCase().includes(needle),
      )
      .slice(0, 40);
  }, [listing, filter]);

  const view = listingState(listing, loading);

  // The list is a convenience, not the only way in. An organisation that refuses personal
  // access tokens leaves somebody with a repository they can name but cannot pick, and a
  // form with no way through is worse than a form with a text field in it.
  const typing = byHand || (view !== 'loading' && view !== 'ready');
  const url = typing ? typed.trim() : (picked?.sshUrl ?? '');

  return (
    <form action={action} className="stack" style={{ gap: 'var(--space-3)' }}>
      <input type="hidden" name="hubId" value={hubId} />
      <input type="hidden" name="repoUrl" value={url} />

      {state?.errorKey ? (
        <Banner tone="error" inline title={t(state.errorKey as 'error.forbidden')} body={state.value} />
      ) : null}

      <div className="field">
        <label htmlFor="repo-filter">{t('project.repo')}</label>
        <span className="help">{t('project.repoHelp')}</span>

        {view === 'loading' ? (
          <div className="repo-list is-loading">
            <span className="sm t3">{t('common.loading')}</span>
          </div>
        ) : view === 'no-token' ? (
          <Banner
            tone="warn"
            inline
            title={t('project.noGitHub')}
            body={t('project.noGitHubHow')}
          />
        ) : view === 'failed' ? (
          <Banner
            tone="error"
            inline
            title={t('project.repoListFailed')}
            body={`${t(failureKey(listing?.problem?.status ?? 0))}${
              listing?.problem?.message ? ` — ${listing.problem.message}` : ''
            }`}
            action={
              <Button size="sm" icon="refresh" onClick={load}>
                {t('common.retry')}
              </Button>
            }
          />
        ) : view === 'empty' ? (
          <Banner tone="info" inline title={t('project.repoNone')} body={t('project.repoNoneHow')} />
        ) : (
          <>
            <input
              id="repo-filter"
              className="input"
              value={filter}
              placeholder={t('project.repoFilter')}
              onChange={(event) => setFilter(event.target.value)}
            />
            <ul className="repo-list">
              {shown.map((repo) => {
                const on = picked?.fullName === repo.fullName;
                return (
                  <li key={repo.fullName}>
                    <button
                      type="button"
                      className={cn('repo-opt', on && 'is-on')}
                      aria-pressed={on}
                      onClick={() => setPicked(on ? null : repo)}
                    >
                      <span className="repo-opt-i" aria-hidden="true">
                        <Icon name={repo.private ? 'lock' : 'globe'} />
                      </span>
                      <span className="repo-opt-txt">
                        <span className="repo-opt-name mono">{repo.fullName}</span>
                        {repo.description ? (
                          <span className="repo-opt-what">{repo.description}</span>
                        ) : null}
                      </span>
                      <span className="repo-opt-branch mono">{repo.defaultBranch}</span>
                      <span className="repo-opt-tick" aria-hidden="true">
                        <Icon name="check" />
                      </span>
                    </button>
                  </li>
                );
              })}
              {shown.length === 0 ? (
                <li className="repo-empty sm t3">{t('project.repoNoMatch')}</li>
              ) : null}
            </ul>
          </>
        )}

        {typing ? (
          <div className="field" style={{ marginTop: 'var(--space-3)' }}>
            <label htmlFor="project-url">{t('project.byHand')}</label>
            <input
              id="project-url"
              className="input mono"
              value={typed}
              placeholder="git@github.com:acme/acme-api.git"
              onChange={(event) => setTyped(event.target.value)}
            />
            <span className="help">{t('project.byHandHelp')}</span>
          </div>
        ) : (
          <button type="button" className="linkish" onClick={() => setByHand(true)}>
            {t('project.byHandOpen')}
          </button>
        )}
      </div>

      <div className="row wrap" style={{ gap: 'var(--space-3)', alignItems: 'flex-end' }}>
        <div className="field" style={{ minWidth: '190px' }}>
          <label htmlFor="project-role">{t('project.role')}</label>
          {roles.length === 0 ? (
            <input id="project-role" name="role" className="input mono" required />
          ) : (
            <select id="project-role" name="role" className="select" required>
              {roles.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          )}
          <span className="help">{t('project.roleAuto')}</span>
        </div>

        <Button type="submit" variant="primary" icon="plus" disabled={pending || !url}>
          {t('project.add')}
        </Button>
      </div>
    </form>
  );
}
