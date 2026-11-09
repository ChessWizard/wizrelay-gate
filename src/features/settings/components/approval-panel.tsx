import { requireUser } from '@/services/auth/context';
import { approvalRules } from '@/services/engine/approval';
import { getLocale } from '@/services/panel/locale';
import { createTranslator } from '@/shared/i18n/translate';
import { Icon } from '@/shared/ui/icons';
import { Panel, Row, Stack } from '@/shared/ui/primitives';
import { ResumeAsking } from './resume-asking';

/**
 * Everything this person has switched off, and one click to switch it back.
 *
 * The offer to stop being asked is made where the asking happens; this is the only place
 * that collects those decisions, because a setting you can turn on but not find again is
 * a trap. Nothing here is editable by anyone else, and nothing an admin sets appears.
 */
export async function ApprovalPanel() {
  const { user } = await requireUser();
  const t = createTranslator(await getLocale());
  const rules = await approvalRules(user.id);
  const rows = [
    ...(rules.blanket ? [{ relayId: '', ...rules.blanket }] : []),
    ...rules.perRelay,
  ];

  return (
    <Panel title={t('approval.title')}>
      <Stack gap={12}>
        <span className="sm t2">{t('approval.lead')}</span>

        {rows.length === 0 ? (
          <Row gap={8}>
            <Icon name="passed" className="ink-passed" />
            <span className="sm t3">{t('approval.none')}</span>
          </Row>
        ) : (
          <Stack gap={8}>
            {rows.map((rule) => (
              <div className="row spread wrap" key={rule.relayId || 'all'} style={{ gap: '8px' }}>
                <Row wrap gap={8}>
                  <span className={rule.relayId ? 'mono sm' : 'sm strong'}>
                    {rule.relayId || t('approval.everyRelay')}
                  </span>
                  {rule.commits ? (
                    <span className="chip s-warned">{t('approval.asksCommits')}</span>
                  ) : null}
                  {rule.pushes ? (
                    <span className="chip s-warned">{t('approval.asksPushes')}</span>
                  ) : null}
                </Row>
                <ResumeAsking relayId={rule.relayId} />
              </div>
            ))}
          </Stack>
        )}
      </Stack>
    </Panel>
  );
}
