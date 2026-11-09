import { getWorkspace } from '@/services/store/store';
import { createTranslator } from '@/shared/i18n/translate';
import { GATE_STATUSES } from '@/core/status/status';
import { Icon } from '@/shared/ui/icons';
import {
  Banner,
  Button,
  Empty,
  LinkButton,
  Panel,
  Row,
  SectionHeader,
  Skeleton,
  Stack,
} from '@/shared/ui/primitives';
import { GatePill, StatusChip } from '@/shared/ui/status';

/**
 * S13 — the system states, on one page.
 *
 * It is a working reference rather than a mock: every banner, status and empty state here
 * is the component the rest of the app uses, so if one drifts, it drifts here too.
 */
export async function SystemScreen() {
  const workspace = await getWorkspace();
  const t = createTranslator(workspace.locale);

  return (
    <div className="page">
      <SectionHeader level={1} title={t('settings.diagnostics')} note="S13" />

      <Panel title={t('banner.guardOff')}>
        <Stack gap={10}>
          <Banner
            tone="error"
            icon="guard"
            title={t('banner.guardOff')}
            body={t('banner.guardOffCauses')}
            action={<LinkButton href="/settings" size="sm">{t('settings.runDoctor')}</LinkButton>}
          />
          <Banner
            tone="info"
            title={t('banner.hubAhead', { version: 3, local: 2 })}
            action={<Button size="sm" variant="primary">{t('banner.sync')}</Button>}
          />
          <Banner tone="warn" title={t('banner.locallyModified')} />
          <Banner tone="error" title={t('banner.offline')} body={t('banner.offlineBody')} />
          <Banner tone="warn" title={t('banner.cliMissing')} body={t('banner.cliMissingHow')} />
          <Banner tone="success" title={t('settings.saved')} />
        </Stack>
      </Panel>

      <Panel title={t('board.column.status')}>
        <Stack gap={10}>
          {GATE_STATUSES.map((status) => (
            <Row key={status} gap={12}>
              <StatusChip status={status} t={t} />
              <GatePill gate="verify" status={status} t={t} duration="2m 40s" />
              <span className="mono xs t3">--status-{status}-fg / -bg / -border</span>
            </Row>
          ))}
          <Row gap={12}>
            <span className="chip s-failed">
              <Icon name="guard" />
              {t('status.guardOff')}
            </span>
            <span className="mono xs t3">banner · uses --status-failed-*</span>
          </Row>
        </Stack>
      </Panel>

      <Panel title={t('common.loading')}>
        <Stack gap={8}>
          <Skeleton width={220} height={16} />
          <Skeleton height={16} />
          <Skeleton width={120} height={16} />
        </Stack>
      </Panel>

      <Panel title={t('board.empty')}>
        <Empty
          title={t('questions.empty')}
          body={t('board.emptyHow')}
          action={<LinkButton href="/relays/new">{t('board.newRelay')}</LinkButton>}
        />
      </Panel>
    </div>
  );
}
