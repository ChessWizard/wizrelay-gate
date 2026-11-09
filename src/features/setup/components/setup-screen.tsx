import { prisma } from '@/services/db/client';
import { requireOwner } from '@/services/auth/context';
import { branding } from '@/services/panel/branding';
import { panelOrigin } from '@/services/panel/origin';
import { listHubs, workspaceFor } from '@/services/panel/workspace';
import { roleCatalogue } from '@/services/workspace/roles';
import { getLocale } from '@/services/panel/locale';
import { createTranslator } from '@/shared/i18n/translate';
import { Panel, Row, SectionHeader, Stack } from '@/shared/ui/primitives';
import { Icon } from '@/shared/ui/icons';
import { HubForm } from '@/features/admin/components/hub-form';
import { ProjectForm } from '@/features/admin/components/project-form';
import { PersonForm } from '@/features/admin/components/person-form';
import { PanelForm } from '@/features/admin/components/panel-form';
import { FinishButton } from './finish-button';
import { assignableGlobalRoles } from '@/core/auth/roles';

export async function SetupScreen() {
  const { viewer } = await requireOwner();
  const t = createTranslator(await getLocale());

  const [hubs, brand, people] = await Promise.all([
    listHubs(),
    branding(),
    prisma.user.count(),
  ]);

  const origin = await panelOrigin();

  const hub = hubs[0] ?? null;
  const roles = hub ? (await roleCatalogue(await workspaceFor(hub, hub.projects))).roles : [];
  const projects = hubs.flatMap((candidate) => candidate.projects);


  const steps = [
    { key: 'setup.step.panel', done: true },
    { key: 'setup.step.hub', done: hubs.length > 0 },
    { key: 'setup.step.projects', done: projects.length > 0 },
    { key: 'setup.step.people', done: people > 1 },
  ];
  const ready = hubs.length > 0 && projects.length > 0;

  return (
    <div className="page">
      <SectionHeader level={1} title={t('setup.title')} note={t('setup.subtitle')} />

      <ol className="csteps">
        {steps.map((step) => (
          <li className={`cstep ${step.done ? 's-passed' : 's-idle'}`} key={step.key}>
            <span className="cdot">
              <Icon name={step.done ? 'passed' : 'idle'} />
            </span>
            <span className="sm strong">{t(step.key as 'setup.step.hub')}</span>
          </li>
        ))}
      </ol>

      <Panel title={t('setup.step.panel')}>
        <PanelForm
          name={brand.name}
          description={brand.description}
          logoUrl={brand.logoUrl}
          faviconUrl={brand.faviconUrl}
        />
      </Panel>

      <Panel title={t('setup.step.hub')}>
        <Stack gap={14}>
          <HubForm />
          {hubs.map((candidate) => (
            <Row key={candidate.id} wrap gap={10}>
              <Icon name="passed" className="ink-passed" />
              <span className="strong">{candidate.name}</span>
              <span className="mono xs t3 trunc">{candidate.url}</span>
            </Row>
          ))}
        </Stack>
      </Panel>

      {hub ? (
        <Panel title={t('setup.step.projects')}>
          <Stack gap={14}>
            <ProjectForm hubId={hub.id} roles={roles} />
            {projects.map((project) => (
              <Row key={project.id} wrap gap={10}>
                <Icon name="passed" className="ink-passed" />
                <span className="mono">{project.role}</span>
                <span className="xs t3 trunc">{project.localPath ?? project.name}</span>
              </Row>
            ))}
          </Stack>
        </Panel>
      ) : null}

      {projects.length > 0 ? (
        <Panel title={t('setup.step.people')}>
          <PersonForm
            assignable={assignableGlobalRoles(viewer)}
            origin={origin}
            projects={hubs.flatMap((candidate) =>
              candidate.projects.map((project) => ({
                id: project.id,
                role: project.role,
                hubName: candidate.name,
              })),
            )}
          />
        </Panel>
      ) : null}

      <Row wrap gap={10}>
        <FinishButton disabled={!ready} />
      </Row>
    </div>
  );
}
