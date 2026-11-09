import Link from 'next/link';
import { notFound } from 'next/navigation';
import { criteriaForRole, readPackage, readPackageFromMachine } from '@/services/packages/files';
import { loadRelay } from '@/services/relays/service';
import { mayWrite } from '@/core/packages/writable';
import type { Owner } from '@/core/packages/writable';
import { isAdmin, rolesIn } from '@/core/auth/roles';
import { requireUser } from '@/services/auth/context';
import { activeContext } from '@/services/panel/active';
import { claudeAvailable } from '@/services/engine/claude';
import { getWorkspace } from '@/services/store/store';
import { createTranslator } from '@/shared/i18n/translate';
import { cn } from '@/shared/lib/cn';
import { Icon } from '@/shared/ui/icons';
import { GlobList } from '@/shared/ui/glob-list';
import { Expand } from '@/shared/ui/expand';
import { FileView } from './file-view';
import {
  Banner,
  Empty,
  LinkButton,
  OwnershipBadge,
  Panel,
  Row,
  SectionHeader,
  Stack,
  VersionChip,
} from '@/shared/ui/primitives';

/**
 * S6 — the research package workspace.
 *
 * Ownership is on the surface, not just enforced: a researcher file is read-only in a
 * developer repository, and a developer file is never overwritten by a pull.
 */
export async function PackageScreen({
  relayId,
  file,
  role,
}: {
  relayId: string;
  file?: string;
  role?: string;
}) {
  const relay = await loadRelay(relayId);
  if (!relay) notFound();
  const workspace = await getWorkspace();
  const t = createTranslator(workspace.locale);

  const activeRole = role && relay.roles.includes(role) ? role : relay.roles[0];
  const { viewer, user } = await requireUser();

  // The panel's own hub copy first. When it holds nothing for this task — which is the
  // normal case before publication, because the work is on somebody's unpushed branch —
  // the machine that has it is asked instead.
  const local = await readPackage(workspace, relay.id, activeRole);
  const remote =
    local.files.length === 0 ? await readPackageFromMachine(user.id, relay.id) : null;
  const { files, criteria, decisions, hubDir, repoDir } = remote ?? local;
  const active = files.find((candidate) => candidate.path === file) ?? files[0];
  const placeholders = files.reduce((total, candidate) => total + (candidate.placeholders ?? 0), 0);
  const published = relay.packageStatus === 'published';
  const roleCriteria = criteriaForRole(criteria, activeRole);
  const ahead = relay.hubVersion !== undefined && relay.hubVersion > relay.version;

  // Which halves of the package this person may write, and whether a gate could be
  // handed an instruction at all.
  const context = await activeContext();
  const project = context.projects.find((candidate) => candidate.role === activeRole);
  const writes: Owner[] = isAdmin(viewer)
    ? ['researcher', 'developer']
    : project
      ? rolesIn(viewer, project.id).map((entry) =>
          entry === 'RESEARCHER' ? 'researcher' : 'developer',
        )
      : [];
  const claude = await claudeAvailable();

  return (
    <div className="page">
      <SectionHeader
        level={1}
        title={t('package.title')}
        note={`${relay.id} · ${relay.slug}`}
        actions={
          <Row wrap gap={10}>
            <LinkButton href={`/package/${relay.id}/validate`} size="sm" icon="shield">
              {t('validate.title')}
            </LinkButton>
            <LinkButton href={`/relay/${relay.id}`} size="sm" icon="chevron">
              {t('package.backToRelay')}
            </LinkButton>
          </Row>
        }
      />

      <div className="pkg-state">
        <span className={published ? 'chip s-passed' : 'chip s-idle'}>
          <Icon name={published ? 'passed' : 'idle'} />
          {t(published ? 'package.state.published' : 'package.state.draft')}
        </span>
        <span className="pkg-state-v">
          <span className="label">{t('board.column.version')}</span>
          <VersionChip ahead={ahead}>v{relay.version}</VersionChip>
          {ahead ? (
            <>
              <Icon name="chevron" />
              <VersionChip>v{relay.hubVersion}</VersionChip>
              <span className="xs t3">{t('package.hubAhead')}</span>
            </>
          ) : null}
        </span>
        <span className="grow" />
        <span className="xs t3">{relay.title}</span>
      </div>

      {published ? (
        <Banner
          tone="info"
          title={t('package.publishedNotice', { next: relay.version + 1 })}
        />
      ) : null}

      {files.length === 0 ? (
        <Empty title={t('package.noFiles')} body={t('package.noFilesHow')} />
      ) : null}

      {files.length > 0 && active ? (
      <div className="pkg-wrap">
      <div className="pkg-grid">
        <Panel title={t('package.files')} bodyClassName="tree">
          <div className="tree">
            <span className="dir">tasks/{relay.slug}/</span>
            {files.map((candidate) => (
              <Link
                key={candidate.path}
                href={`/package/${relay.id}?file=${encodeURIComponent(candidate.path)}${
                  activeRole ? `&role=${activeRole}` : ''
                }`}
                className={cn(candidate.path === active.path && 'is-on')}
                title={candidate.source === 'repo' ? repoDir : hubDir}
              >
                <Icon name={candidate.source === 'repo' ? 'branch' : 'hub'} />
                <span className="grow mono">{candidate.path}</span>
                {candidate.placeholders ? (
                  <span className="chip s-failed">{candidate.placeholders}</span>
                ) : null}
              </Link>
            ))}
          </div>
        </Panel>

        <Panel
          title={<span className="mono">{active.path}</span>}
          aside={
            <Row gap={8}>
              <OwnershipBadge
                owner={active.owner}
                label={
                  active.owner === 'researcher'
                    ? t('package.owner.researcher')
                    : t('package.owner.developer')
                }
              />
              <span className="xs t3">
                {active.owner === 'researcher' ? t('package.readOnly') : t('package.neverOverwritten')}
              </span>
              <span className="xs t3">
                {t(active.source === 'repo' ? 'package.fromRepo' : 'package.fromHub')}
              </span>
            </Row>
          }
        >
          <Expand title={active.path} note={t('package.files')} wide>
            <FileView
              path={active.path}
              body={active.body}
              bytes={active.bytes}
              relayId={relay.id}
              role={activeRole}
              canEdit={mayWrite(active.path, active.owner, writes).ok}
              canAsk={claude}
            />
          </Expand>
        </Panel>

        <Stack gap={16} className="pkg-aside">
          <Panel
            title={t('package.findings')}
            aside={
              placeholders > 0 ? (
                <span className="chip s-failed">
                  <Icon name="failed" />
                  {t('package.placeholders', { count: placeholders })}
                </span>
              ) : (
                <span className="chip s-passed">
                  <Icon name="passed" />
                  {t('package.noFindings')}
                </span>
              )
            }
          >
            <Expand title={t('package.findings')}>
            <Stack gap={6}>
              {files
                .filter((candidate) => candidate.placeholders)
                .map((candidate) => (
                  <Row key={candidate.path} gap={8}>
                    <Icon name="warned" className="ink-warned" />
                    <span className="mono sm">{candidate.path}</span>
                    <span className="xs t3">
                      {t('package.placeholders', { count: candidate.placeholders ?? 0 })}
                    </span>
                  </Row>
                ))}
              {placeholders === 0 ? <span className="sm t3">{t('package.noFindings')}</span> : null}
            </Stack>
            </Expand>
          </Panel>

          <Panel title={t('package.scope')}>
            <Expand title={t('package.scope')}>
            <Stack gap={8}>
              {Object.entries(relay.scope).map(([role, scope]) => (
                <Stack gap={4} key={role}>
                  <span className="xs t3 mono">{role}</span>
                  <GlobList allow={scope.allow} deny={scope.deny} initial={6} />
                </Stack>
              ))}
            </Stack>
            </Expand>
          </Panel>

          <Panel
            title={t('package.criteria')}
            aside={<span className="count-badge">{roleCriteria.length}</span>}
          >
            <Expand title={t('package.criteria')}>
            <Stack gap={8}>
              {roleCriteria.length === 0 ? (
                <span className="sm t3">{t('package.noCriteria')}</span>
              ) : null}
              {roleCriteria.map((criterion) => (
                <article className="ac-card" key={criterion.id}>
                  <div className="ac-card-h">
                    <span className="ac-id mono">{criterion.id}</span>
                    <span className="ac-title">{criterion.title}</span>
                  </div>
                  {criterion.verification ? (
                    <div className="ac-verify">
                      <span className="label">{t('package.verification')}</span>
                      <code className="mono">{criterion.verification}</code>
                    </div>
                  ) : (
                    <span className="ac-missing">
                      <Icon name="warned" />
                      {t('verify.notVerifiedWhy')}
                    </span>
                  )}
                </article>
              ))}
            </Stack>
            </Expand>
          </Panel>

          <Panel
            title={t('package.decisions')}
            aside={<span className="count-badge">{decisions.length}</span>}
          >
            <Expand title={t('package.decisions')}>
            <Stack gap={8}>
              {decisions.length === 0 ? (
                <span className="sm t3">{t('package.noDecisions')}</span>
              ) : null}
              {decisions.map((decision) => (
                <article className="dc-card" key={decision.id}>
                  <div className="dc-card-h">
                    <span className="ac-id mono">{decision.id}</span>
                    <span className="ac-title">{decision.title}</span>
                    <span className="grow" />
                    <VersionChip>v{decision.version}</VersionChip>
                    <span className="xs t3">{decision.date}</span>
                  </div>
                  {decision.question ? (
                    <p className="dc-line">
                      <span className="label">{t('package.decision.question')}</span>
                      {decision.question}
                    </p>
                  ) : null}
                  {decision.decision ? (
                    <p className="dc-line is-answer">
                      <span className="label">{t('package.decision.decided')}</span>
                      {decision.decision}
                    </p>
                  ) : null}
                  {decision.rationale ? (
                    <p className="dc-line">
                      <span className="label">{t('package.decision.because')}</span>
                      {decision.rationale}
                    </p>
                  ) : null}
                  {decision.impact ? (
                    <p className="dc-line">
                      <span className="label">{t('package.decision.impact')}</span>
                      {decision.impact}
                    </p>
                  ) : null}
                </article>
              ))}
            </Stack>
            </Expand>
          </Panel>
        </Stack>
      </div>
      </div>
      ) : null}
    </div>
  );
}
