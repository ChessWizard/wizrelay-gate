import Link from 'next/link';
import type { ProjectRole } from '@/core/auth/roles';
import { isAdmin } from '@/core/auth/roles';
import { initials, actorTone } from '@/core/identity/actor';
import { relativeTime } from '@/core/time/format';
import { prisma } from '@/services/db/client';
import { requireUser } from '@/services/auth/context';
import { getLocale } from '@/services/panel/locale';
import { visibleHubs } from '@/services/panel/workspace';
import { createTranslator } from '@/shared/i18n/translate';
import { Empty, LinkButton, Panel, Row, SectionHeader, Stack } from '@/shared/ui/primitives';
import { Table, TableBox } from '@/shared/ui/data';
import { AccessSummary } from '@/shared/ui/role-picker';

/**
 * Who is on the panel.
 *
 * This used to be the bottom third of the administration screen, which meant that
 * answering "who else is on this project" required a permission nobody needs for the
 * question. Everybody can read the roster; changing it is still an administrator's, and
 * the row links there rather than pretending otherwise.
 *
 * A member sees the projects they are in. Showing somebody the whole company's
 * memberships would say more about how the organisation is arranged than the roster is
 * for, so the access column covers the projects this person shares.
 */
export async function PeopleScreen() {
  const { viewer } = await requireUser();
  const locale = await getLocale();
  const t = createTranslator(locale);

  const [people, hubs] = await Promise.all([
    prisma.user.findMany({
      where: { disabled: false },
      orderBy: [{ globalRole: 'asc' }, { name: 'asc' }],
      include: { memberships: true },
    }),
    visibleHubs(viewer),
  ]);

  const admin = isAdmin(viewer);
  const projects = hubs.flatMap((hub) => hub.projects);

  return (
    <div className="page">
      <SectionHeader
        level={1}
        title={t('people.title')}
        count={people.length}
        note={t('people.pageSubtitle')}
        actions={
          admin ? (
            <LinkButton href="/admin?tab=people" variant="primary" icon="plus">
              {t('people.invite')}
            </LinkButton>
          ) : undefined
        }
      />

      {people.length === 0 ? (
        <Empty title={t('people.none')} />
      ) : (
        <Panel>
          <Stack gap={12}>
            <TableBox>
              <Table
                label={t('people.title')}
                head={
                  <tr>
                    <th>{t('people.name')}</th>
                    <th>{t('people.globalRole')}</th>
                    <th>{t('people.projectAccess')}</th>
                    <th className="r">{t('people.lastSeen')}</th>
                  </tr>
                }
              >
                {people.map((person) => (
                  <tr key={person.id}>
                    <td>
                      <Row gap={10}>
                        <span
                          className="av"
                          data-tone={actorTone({ id: person.email })}
                          aria-hidden="true"
                        >
                          {initials({ name: person.name, email: person.email })}
                        </span>
                        <Stack gap={1}>
                          {admin ? (
                            <Link className="strong" href={`/admin/people/${person.id}`}>
                              {person.name}
                            </Link>
                          ) : (
                            <span className="strong">{person.name}</span>
                          )}
                          <span className="xs t3 mono">{person.email}</span>
                        </Stack>
                      </Row>
                    </td>
                    <td>
                      <span className="chip s-idle">
                        {t(`role.${person.globalRole}` as 'role.ADMIN')}
                      </span>
                    </td>
                    <td>
                      <AccessSummary
                        granted={projects.map((project) => ({
                          projectRole: project.role,
                          roles: (person.memberships.find((m) => m.projectId === project.id)
                            ?.roles ?? []) as ProjectRole[],
                        }))}
                      />
                    </td>
                    <td className="r xs t3">
                      {person.lastLoginAt
                        ? relativeTime(person.lastLoginAt.toISOString(), locale)
                        : t('people.never')}
                    </td>
                  </tr>
                ))}
              </Table>
            </TableBox>
            {admin ? null : <span className="help">{t('people.readOnly')}</span>}
          </Stack>
        </Panel>
      )}
    </div>
  );
}
