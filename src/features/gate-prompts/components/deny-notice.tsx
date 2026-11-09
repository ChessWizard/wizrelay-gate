import type { Translator } from '@/shared/i18n/translate';
import { Icon } from '@/shared/ui/icons';

/**
 * A `deny` is not a prompt. It cannot be overridden here, and the card says so — then it
 * gives the way forward, which is the question loop, not a workaround.
 */
export function DenyNotice({
  file,
  pattern,
  taskId,
  t,
  action,
}: {
  file: string;
  pattern: string;
  taskId: string;
  t: Translator;
  action?: React.ReactNode;
}) {
  return (
    <div className="banner inline b-error" role="note">
      <Icon name="shield" className="bi" />
      <div className="grow stack" style={{ gap: '4px' }}>
        <span className="bt">{t('console.denyTitle')}</span>
        <span className="sm">
          <span className="mono">{file}</span> is explicitly denied by the scope of{' '}
          <span className="mono">{taskId}</span> (pattern <span className="mono">{pattern}</span>).
        </span>
        <span className="sm t2">{t('console.denyWay')}</span>
      </div>
      {action}
    </div>
  );
}
