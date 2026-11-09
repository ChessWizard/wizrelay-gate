import type { HubConnection, RepoConnection } from '@/services/workspace/types';

/**
 * The sample workspace.
 *
 * It is the data the design was drawn against, and it uses the placeholder names the
 * wizrelay repository uses everywhere (`acme`, `api-service`, `web-app`, the tenant quota
 * task). Demo mode seeds the store from here so the whole dashboard is explorable before
 * anything real is connected — and so the screens can be reviewed without a hub.
 */
export const SAMPLE_HUB: HubConnection = {
  url: 'git@github.com:acme/research-hub.git',
  branch: 'main',
  name: 'acme-research-hub',
  language: 'en',
  tracker: { type: 'clickup', id_prefix: 'CU-' },
  roles: ['backend', 'frontend', 'mobile'],
  reachable: true,
};

export const SAMPLE_REPOS: RepoConnection[] = [
  {
    id: 'api-service',
    path: '/Users/you/code/api-service',
    role: 'backend',
    repo: 'acme/api-service',
    baseRef: 'origin/main',
    profile: {
      stack: 'Python 3.12 / FastAPI / PostgreSQL',
      commands: {
        test: 'pytest -q',
        test_targeted: 'pytest -q {path}',
        lint: 'ruff check .',
        typecheck: 'mypy app',
      },
      codebase_size: 'medium',
      test_maturity: 'medium',
      critical_paths: ['app/auth/**', 'app/billing/**'],
      legacy_paths: [],
    },
  },
  {
    id: 'web-app',
    path: '/Users/you/code/web-app',
    role: 'frontend',
    repo: 'acme/web-app',
    baseRef: 'origin/main',
    profile: {
      stack: 'TypeScript / React / Vite',
      commands: {
        test: 'npm test --silent',
        test_targeted: 'npm test --silent -- {path}',
        lint: 'eslint .',
        typecheck: 'tsc --noEmit',
      },
      codebase_size: 'medium',
      test_maturity: 'high',
      critical_paths: ['src/features/billing/**'],
      legacy_paths: ['src/legacy/**'],
    },
  },
];
