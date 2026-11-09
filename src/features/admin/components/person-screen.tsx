import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { GlobalRole, ProjectRole } from '@/core/auth/roles';
import { assignableGlobalRoles } from '@/core/auth/roles';
import { initials, actorTone } from '@/core/identity/actor';
import { relativeTime } from '@/core/time/format';
import { prisma } from '@/services/db/client';
import { requireAdmin } from '@/services/auth/context';
import { getLocale } from '@/services/panel/locale';
import { panelOrigin } from '@/services/panel/origin';
import { listHubs } from '@/services/panel/workspace';
import { createTranslator } from '@/shared/i18n/translate';
import { Empty, KeyValues, Panel, Row, SectionHeader, Stack } from '@/shared/ui/primitives';
import { Hint } from '@/shared/ui/hint';
import { AccessList, AccessRow } from '@/shared/ui/role-picker';
import { GlobalRoleSelect, ProjectRoleChips } from './role-controls';
import { InviteLink } from './invite-link';
import { RemovePersonButton } from './removers';

/**
 * One person.
 *
 * What they are, where they may work, and the two things an admin comes here to do:
 * change that, or take them out. Nothing is duplicated from the hub or the tracker — the
 * panel only knows who may sign in and what they may reach.
 */
export async function PersonScreen({ id }: { id: string }) {
  const { viewer, user } = await requireAdmin();
  const locale = await getLocale();
  const t = createTranslator(locale);

  const [person, hubs] = await Promise.all([
    prisma.user.findUnique({ where: { id }, include: { memberships: true } }),
    listHubs(),
  ]);
  if (!person) notFound();

  const origin = await panelOrigin();
  const locked = person.globalRole === 'OWNER' || person.id === user.id;
  const projects = hubs.flatMap((hub) => hub.projects.map((project) => ({ ...project, hub })));

  return (
    <div className="page">
      <SectionHeader
        level={1}
        title={person.name}
        note={
          <Link className="sm" href="/admin">
            {t('nav.admin')}
          </Link>
        }
      />

      <Panel title={t('people.detail')}>
        <Stack gap={16}>
          <Row gap={12} wrap>
            <span className="av av-lg" data-tone={actorTone({ id: person.email })} aria-hidden="true">
              {initials({ name: person.name, email: person.email })}
            </span>
            <Stack gap={2}>
              <span className="strong">{person.name}</span>
              <span className="sm t3 mono">{person.email}</span>
            </Stack>
            {person.inviteToken ? <span className="chip s-waiting">{t('people.pending')}</span> : null}
            {person.disabled ? <span className="chip s-skipped">{t('people.disabled')}</span> : null}
          </Row>

          <KeyValues
            items={[
              {
                key: t('people.globalRole'),
                value: (
                  <GlobalRoleSelect
                    userId={person.id}
                    current={person.globalRole as GlobalRole}
                    assignable={assignableGlobalRoles(viewer)}
                    locked={locked}
                  />
                ),
              },
              { key: t('people.claudeRef'), value: <span className="mono">{person.claudeRef ?? '—'}</span> },
              {
                key: t('people.lastSeen'),
                value: person.lastLoginAt
                  ? relativeTime(person.lastLoginAt.toISOString(), locale)
                  : t('people.never'),
              },
              { key: t('people.joined'), value: relativeTime(person.createdAt.toISOString(), locale) },
            ]}
          />

          <InviteLink userId={person.id} origin={origin} locked={locked} />
        </Stack>
      </Panel>

      <Panel title={t('people.projectRoles')} aside={<Hint title={t('people.projectRoles')}>{t('hint.projectRoles')}</Hint>}>
        {projects.length === 0 ? (
          <Empty title={t('project.none')} />
        ) : (
          <AccessList>
            {projects.map((project) => (
              <AccessRow key={project.id} role={project.role} hubName={project.hub.name}>
                <ProjectRoleChips
                  userId={person.id}
                  projectId={project.id}
                  current={
                    (person.memberships.find((m) => m.projectId === project.id)?.roles ??
                      []) as ProjectRole[]
                  }
                />
              </AccessRow>
            ))}
          </AccessList>
        )}
      </Panel>

      <Panel title={t('people.remove')}>
        <Stack gap={10}>
          <span className="sm t3">{locked ? t('people.cannotRemove') : t('people.removeNote')}</span>
          <Row>
            <RemovePersonButton userId={person.id} locked={locked} />
          </Row>
        </Stack>
      </Panel>
    </div>
  );
}
