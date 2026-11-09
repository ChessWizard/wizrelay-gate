import { getWorkspace } from '@/services/store/store';
import { roleCatalogue } from '@/services/workspace/roles';
import { createTranslator } from '@/shared/i18n/translate';
import { Panel, SectionHeader, Stack } from '@/shared/ui/primitives';
import { createRelay } from '../actions';

/** G1 Intake, as a form: a tracker reference and the roles the task spans. */
export async function NewRelayForm() {
  const workspace = await getWorkspace();
  const t = createTranslator(workspace.locale);
  const catalogue = await roleCatalogue(workspace);
  const roles = catalogue.roles;

  return (
    <div className="page">
      <SectionHeader level={1} title={t('gate.intake')} note={t('board.newRelay')} />
      <Panel title={t('gate.intake')}>
        <form action={createRelay}>
          <Stack gap={14}>
            <div className="field">
              <label htmlFor="reference">{t('settings.tracker')}</label>
              <input
                id="reference"
                name="reference"
                className="input mono"
                placeholder="86c1abcd"
                required
              />
              <span className="help">
                {workspace.hub?.tracker?.id_prefix
                  ? `${workspace.hub.tracker.id_prefix}86c1abcd`
                  : ''}
              </span>
            </div>
            <div className="field">
              <label htmlFor="title">{t('board.column.title')}</label>
              <input id="title" name="title" className="input" required />
            </div>
            <div className="field">
              <label htmlFor="roles">{t('init.repoRole')}</label>
              {roles.length === 0 ? (
                <>
                  <input id="roles" name="roles" className="input mono" required />
                  <span className="help err">{t('roles.none')}</span>
                </>
              ) : (
                <>
                  <div className="row wrap" style={{ gap: '6px' }}>
                    {roles.map((role) => (
                      <label key={role} className="check-chip">
                        <input type="checkbox" name="roles" value={role} defaultChecked />
                        <span className="mono">{role}</span>
                      </label>
                    ))}
                  </div>
                  <span className="help">
                    {catalogue.source === 'hub' ? t('roles.fromHub') : t('roles.observed')}
                  </span>
                </>
              )}
            </div>
            <div>
              <button type="submit" className="btn btn-primary">
                {t('run.startGate')}
              </button>
            </div>
          </Stack>
        </form>
      </Panel>
    </div>
  );
}
