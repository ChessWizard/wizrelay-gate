import type { GlobalRole, ProjectRole } from '@/core/auth/roles';
import { assignableGlobalRoles, canManagePanel } from '@/core/auth/roles';
import { prisma } from '@/services/db/client';
import { requireAdmin } from '@/services/auth/context';
import { branding } from '@/services/panel/branding';
import { listHubs } from '@/services/panel/workspace';
import { roleCatalogue } from '@/services/workspace/roles';
import { workspaceFor } from '@/services/panel/workspace';
import { relativeTime } from '@/core/time/format';
import { createTranslator } from '@/shared/i18n/translate';
import { getLocale } from '@/services/panel/locale';
import { panelOrigin } from '@/services/panel/origin';
import { Empty, Grow, Panel, Row, SectionHeader, Stack } from '@/shared/ui/primitives';
import Link from 'next/link';
import { Table, TableBox } from '@/shared/ui/data';
import { Hint } from '@/shared/ui/hint';
import { TabPane, Tabs } from '@/shared/ui/tabs';
import { remoteBranches } from '@/services/workspace/connect';
import { reportedHubCheckouts } from '@/services/agent/placement';
import { HubForm } from './hub-form';
import { HubSettings } from './hub-settings';
import { ProjectForm } from './project-form';
import { PersonForm } from './person-form';
import { PanelForm } from './panel-form';
import { AccessSummary } from '@/shared/ui/role-picker';
import { DisableToggle, GlobalRoleSelect } from './role-controls';
import { ResearchLeadSelect } from './research-lead';
import { RemoveHubButton, RemoveProjectButton } from './removers';

export async function AdminScreen({ tab }: { tab?: string }) {
  const { viewer, user } = await requireAdmin();
  const locale = await getLocale();
  const t = createTranslator(locale);

  const [hubs, people, brand] = await Promise.all([
    listHubs(),
    prisma.user.findMany({
      orderBy: [{ globalRole: 'asc' }, { createdAt: 'asc' }],
      include: { memberships: true },
    }),
    branding(),
  ]);

  const origin = await panelOrigin();
  const assignable = assignableGlobalRoles(viewer);
  const active = ['general', 'hubs', 'people'].includes(tab ?? '') ? (tab as string) : 'general';
  const projects = hubs.flatMap((hub) => hub.projects);


  const rolesFor = async (hubId: string): Promise<string[]> => {
    const hub = hubs.find((candidate) => candidate.id === hubId);
    if (!hub) return [];
    const catalogue = await roleCatalogue(await workspaceFor(hub, hub.projects));
    return catalogue.roles;
  };
  const hubRoles = Object.fromEntries(
    await Promise.all(hubs.map(async (hub) => [hub.id, await rolesFor(hub.id)] as const)),
  );

  // What the paired machines say they have, so the hub's own folder can be picked rather
  // than typed. Whether the panel can actually open one is a separate question the form
  // answers for each.
  const hubOffers = (await reportedHubCheckouts(user.id)).map((offer) => ({
    machine: offer.machine,
    path: offer.path,
    sameHost: offer.sameHost,
  }));

  const hubBranches = Object.fromEntries(
    await Promise.all(
      hubs.map(async (hub) => [hub.id, await remoteBranches(hub.url, user.id)] as const),
    ),
  );

  return (
    <div className="page">
      <SectionHeader level={1} title={t('nav.admin')} note={t('admin.subtitle')} />

      <Tabs
        tabs={[
          { id: 'general', label: t('admin.tab.general'), icon: 'settings' },
          { id: 'hubs', label: t('hub.title'), icon: 'hub', count: hubs.length },
          { id: 'people', label: t('people.title'), icon: 'people', count: people.length },
        ]}
        active={active}
      >
        <TabPane when="general" active={active}>
      {canManagePanel(viewer) ? (
        <Panel title={t('setup.step.panel')}>
          <PanelForm
            name={brand.name}
            description={brand.description}
            logoUrl={brand.logoUrl}
            faviconUrl={brand.faviconUrl}
          />
        </Panel>
      ) : null}
        </TabPane>

        <TabPane when="hubs" active={active}>
      <Panel title={t('hub.title')} aside={<span className="count-badge">{hubs.length}</span>}>
        <Stack gap={16}>
          <HubForm />
          {hubs.length === 0 ? (
            <span className="sm t3">{t('hub.none')}</span>
          ) : (
            hubs.map((hub) => (
              <Stack gap={10} key={hub.id}>
                <Row wrap gap={10}>
                  <span className="strong">{hub.name}</span>
                  <span className="mono xs t3 trunc">{hub.url}</span>
                  <span className="chip s-idle">{hub.branch}</span>
                  {hub.trackerType ? <span className="chip s-idle">{hub.trackerType}</span> : null}
                  <Grow />
                  <RemoveHubButton hubId={hub.id} projects={hub.projects.length} />
                </Row>
                <HubSettings
                  hubId={hub.id}
                  branch={hub.branch}
                  branches={hubBranches[hub.id] ?? []}
                  trackerType={hub.trackerType}
                  trackerPrefix={hub.trackerPrefix}
                  localPath={hub.localPath}
                  offers={hubOffers}
                />

                <ProjectForm
                  hubId={hub.id}
                  roles={hubRoles[hub.id] ?? []}
                />
                {hub.projects.length === 0 ? (
                  <span className="sm t3">{t('project.none')}</span>
                ) : (
                  <TableBox>
                    <Table
                      label={t('project.title')}
                      head={
                        <tr>
                          <th className="mono">
                            <span className="row" style={{ gap: '6px' }}>
                              {t('project.role')}
                              <Hint title={t('project.role')}>{t('hint.hubRole')}</Hint>
                            </span>
                          </th>
                          <th>{t('project.repo')}</th>
                          <th>
                            <span className="row" style={{ gap: '6px' }}>
                              {t('project.researchLead')}
                              <Hint title={t('project.researchLead')}>{t('hint.researchLead')}</Hint>
                            </span>
                          </th>
                          <th className="r" />
                        </tr>
                      }
                    >
                      {hub.projects.map((project) => (
                        <tr key={project.id}>
                          <td className="mono">{project.role}</td>
                          <td className="trunc">{project.localPath ?? project.repoUrl ?? project.name}</td>
                          <td>
                            <ResearchLeadSelect
                              projectId={project.id}
                              current={project.researchLeadId}
                              people={people.map((person) => ({ id: person.id, name: person.name }))}
                            />
                          </td>
                          <td className="r">
                            <RemoveProjectButton projectId={project.id} />
                          </td>
                        </tr>
                      ))}
                    </Table>
                  </TableBox>
                )}
              </Stack>
            ))
          )}
        </Stack>
      </Panel>
        </TabPane>

        <TabPane when="people" active={active}>
      <Panel title={t('people.title')} aside={<span className="count-badge">{people.length}</span>}>
        <Stack gap={16}>
          <PersonForm
            assignable={assignable}
            origin={origin}
            projects={hubs.flatMap((hub) =>
              hub.projects.map((project) => ({
                id: project.id,
                role: project.role,
                hubName: hub.name,
              })),
            )}
          />

          {people.length === 0 ? (
            <Empty title={t('people.none')} />
          ) : (
            <TableBox>
              <Table
                label={t('people.title')}
                head={
                  <tr>
                    <th>{t('people.name')}</th>
                    <th>
                      <span className="row" style={{ gap: '6px' }}>
                        {t('people.globalRole')}
                        <Hint title={t('people.globalRole')}>{t('hint.panelRole')}</Hint>
                      </span>
                    </th>
                    <th>
                      <span className="row" style={{ gap: '6px' }}>
                        {t('people.projectAccess')}
                        <Hint title={t('people.projectRoles')}>{t('hint.projectRoles')}</Hint>
                      </span>
                    </th>
                    <th className="r">{t('people.lastSeen')}</th>
                    <th />
                  </tr>
                }
              >
                {people.map((person) => {
                  const locked = person.globalRole === 'OWNER' || person.id === user.id;
                  return (
                    <tr key={person.id} className={person.disabled ? 'is-muted' : undefined}>
                      <td>
                        <Stack gap={1}>
                          <Row gap={6}>
                            <Link className="strong" href={`/admin/people/${person.id}`}>
                              {person.name}
                            </Link>
                            {person.inviteToken ? (
                              <span className="chip s-waiting">{t('people.pending')}</span>
                            ) : null}
                            {person.disabled ? (
                              <span className="chip s-skipped">{t('people.disabled')}</span>
                            ) : null}
                          </Row>
                          <span className="xs t3 mono">{person.email}</span>
                        </Stack>
                      </td>
                      <td>
                        <GlobalRoleSelect
                          userId={person.id}
                          current={person.globalRole as GlobalRole}
                          assignable={assignable}
                          locked={locked}
                        />
                      </td>
                      <td>
                        <Row gap={8} wrap>
                          <AccessSummary
                            granted={projects.map((project) => ({
                              projectRole: project.role,
                              roles: (person.memberships.find((m) => m.projectId === project.id)
                                ?.roles ?? []) as ProjectRole[],
                            }))}
                          />
                          <Link className="xs" href={`/admin/people/${person.id}`}>
                            {t('people.editAccess')}
                          </Link>
                        </Row>
                      </td>
                      <td className="r xs t3">
                        {person.lastLoginAt ? relativeTime(person.lastLoginAt.toISOString(), locale) : t('people.never')}
                      </td>
                      <td className="r">
                        <DisableToggle userId={person.id} disabled={person.disabled} locked={locked} />
                      </td>
                    </tr>
                  );
                })}
              </Table>
            </TableBox>
          )}

          <span className="help">{t('people.ownerNote')}</span>
        </Stack>
      </Panel>
        </TabPane>
      </Tabs>
    </div>
  );
}
