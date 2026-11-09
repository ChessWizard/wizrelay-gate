import type { ConnectionKind } from '@prisma/client';
import { prisma } from '@/services/db/client';
import { requireUser } from '@/services/auth/context';
import { decryptSecret, maskSecret } from '@/services/auth/crypto';
import { claudeAvailable } from '@/services/engine/claude';
import { panelOrigin } from '@/services/panel/origin';
import { getLocale } from '@/services/panel/locale';
import { createTranslator } from '@/shared/i18n/translate';
import { Panel, SectionHeader, Stack } from '@/shared/ui/primitives';
import { ConnectionCard } from './connection-card';
import { MachinesPanel } from '@/features/agents/components/machines-panel';

/**
 * What each token is for, and what it has to be allowed to do.
 *
 * Written in the provider's own words — the labels on the page where the token is made —
 * because a list of API scopes is useless to somebody standing in front of a form with
 * checkboxes on it.
 */
const KINDS: {
  kind: ConnectionKind;
  titleKey: string;
  helpKey: string;
  docs: string;
  needs?: { labelKey: string; value: string }[];
}[] = [
  {
    kind: 'CLAUDE',
    titleKey: 'connections.claude',
    helpKey: 'connections.claudeHelp',
    docs: 'https://docs.claude.com/en/docs/claude-code/overview',
  },
  {
    kind: 'GITHUB',
    titleKey: 'connections.github',
    helpKey: 'connections.githubHelp',
    docs: 'https://github.com/settings/personal-access-tokens',
    needs: [
      { labelKey: 'connections.gh.contents', value: 'Contents · Read' },
      { labelKey: 'connections.gh.metadata', value: 'Metadata · Read' },
      { labelKey: 'connections.gh.pulls', value: 'Pull requests · Read' },
      { labelKey: 'connections.gh.classic', value: 'repo' },
    ],
  },
  {
    kind: 'CLICKUP',
    titleKey: 'connections.clickup',
    helpKey: 'connections.clickupHelp',
    docs: 'https://app.clickup.com/settings/apps',
  },
];

export async function ConnectionsScreen() {
  const { user } = await requireUser();
  const t = createTranslator(await getLocale());

  const [rows, hasClaudeCli] = await Promise.all([
    prisma.connection.findMany({ where: { userId: user.id } }),
    claudeAvailable(),
  ]);

  const panelUrl = await panelOrigin();

  return (
    <div className="page">
      <SectionHeader level={1} title={t('connections.title')} note={t('connections.subtitle')} />

      <MachinesPanel panelUrl={panelUrl} />

      <div className="cols-2">
        {KINDS.map((entry) => {
          const row = rows.find((candidate) => candidate.kind === entry.kind);
          const secret = decryptSecret(row?.secretEnc);
          return (
            <ConnectionCard
              key={entry.kind}
              kind={entry.kind}
              title={t(entry.titleKey as 'connections.claude')}
              help={t(entry.helpKey as 'connections.claudeHelp')}
              docs={entry.docs}
              connected={entry.kind === 'CLAUDE' ? hasClaudeCli || Boolean(secret) : Boolean(secret)}
              masked={secret ? maskSecret(secret) : null}
              needsToken={entry.kind !== 'CLAUDE'}
              needs={entry.needs?.map((need) => ({
                label: t(need.labelKey as 'connections.gh.contents'),
                value: need.value,
              }))}
            />
          );
        })}
      </div>

      <Panel title={t('connections.claude')}>
        <Stack gap={6}>
          <span className="sm t2">{t(hasClaudeCli ? 'ready.claudeFound' : 'ready.claudeMissing')}</span>
          {hasClaudeCli ? null : <code className="cmd mono">npm i -g @anthropic-ai/claude-code</code>}
        </Stack>
      </Panel>
    </div>
  );
}
