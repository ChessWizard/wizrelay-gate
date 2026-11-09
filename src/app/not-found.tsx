import { getWorkspace } from '@/services/store/store';
import { createTranslator } from '@/shared/i18n/translate';
import { Empty, LinkButton } from '@/shared/ui/primitives';

export default async function NotFound() {
  const workspace = await getWorkspace();
  const t = createTranslator(workspace.locale);

  return (
    <div className="shell app-root">
      <div className="main">
        <div className="page">
          <Empty
            title={t('error.notFound')}
            body={t('error.notFoundBody')}
            action={
              <LinkButton href="/" variant="primary">
                {t('error.backToBoard')}
              </LinkButton>
            }
          />
        </div>
      </div>
    </div>
  );
}
