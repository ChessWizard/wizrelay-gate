import coreWebVitals from 'eslint-config-next/core-web-vitals';
import typescript from 'eslint-config-next/typescript';

/**
 * Next 16 ships flat configs, so they are spread directly. The design system CSS is
 * vendored from the design canvas and is not linted here; it is reviewed as a design
 * artefact, not as app source.
 */
const config = [
  {
    ignores: [
      '.next/**',
      '.next-verify/**',
      'node_modules/**',
      'src/generated/**',
      'src/shared/design-system/**',
      'docs/**',
      // Where the panel keeps hub clones and the repositories it cloned itself. When
      // `WIZRELAY_GATE_HOME` points inside the project, as it does in development, this
      // folder holds somebody else's source — linting it reports their code as ours.
      '.wizrelay-gate/**',
    ],
  },
  ...coreWebVitals,
  ...typescript,
  {
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
];

export default config;
