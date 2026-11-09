import Link from 'next/link';
import { relativeTime } from '@/core/time/format';
import { requireUser } from '@/services/auth/context';
import { listInbox } from '@/services/panel/inbox';
import { getLocale } from '@/services/panel/locale';
import { createTranslator } from '@/shared/i18n/translate';
import { cn } from '@/shared/lib/cn';
import { Icon } from '@/shared/ui/icons';
import { Empty, Panel, Row, SectionHeader, Stack } from '@/shared/ui/primitives';
import { ReadAllButton, ReadButton } from './inbox-actions';

const ICON = { QUESTION: 'questions', RESEARCH_READY: 'passed', MENTION: 'people' } as const;

export async function InboxScreen() {
  const { user } = await requireUser();
  const locale = await getLocale();
  const t = createTranslator(locale);

  const items = await listInbox(user.id);
  const unread = items.filter((item) => !item.readAt).length;

  return (
    <div className="page">
      <SectionHeader
        level={1}
        title={t('inbox.title')}
        count={unread || undefined}
        actions={unread > 0 ? <ReadAllButton /> : undefined}
      />

      {items.length === 0 ? (
        <Empty title={t('inbox.empty')} body={t('inbox.emptyHow')} />
      ) : (
        <Panel>
          <div className="checks">
            {items.map((item) => (
              <div className={cn('check', !item.readAt && 'is-unread')} key={item.id}>
                <span className={cn('ci', item.readAt ? 's-idle' : 's-waiting')}>
                  <Icon name={ICON[item.kind]} />
                </span>
                <Stack gap={2}>
                  <Row wrap gap={8}>
                    <span className="sm strong">{item.title}</span>
                    <span className="chip s-idle">{t(`inbox.kind.${item.kind}` as 'inbox.kind.QUESTION')}</span>
                    {item.projectName ? (
                      <span className="xs t3">
                        {t('inbox.fromProject', { project: item.projectName })}
                      </span>
                    ) : null}
                  </Row>
                  {item.body ? <span className="xs t2">{item.body}</span> : null}
                  {item.href ? (
                    <Link className="xs" href={item.href}>
                      {t('todo.open')}
                    </Link>
                  ) : null}
                </Stack>
                <Row gap={8}>
                  <span className="xs t3 num">{relativeTime(item.createdAt.toISOString(), locale)}</span>
                  {item.readAt ? null : <ReadButton id={item.id} />}
                </Row>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}
