// Only here so the guardrails ladder can measure size and cognitive complexity
// (`mido` injects the max-lines / complexity / sonarjs rules through this
// config). Linting itself is oxlint's job — see the lint command in .mido.toml.
import tsParser from '@typescript-eslint/parser';
import sonarjs from 'eslint-plugin-sonarjs';

export default [
  {
    files: ['src/**/*.ts', '*.ts'],
    languageOptions: { parser: tsParser },
    plugins: { sonarjs },
  },
];
