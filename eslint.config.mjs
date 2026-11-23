import js from '@eslint/js';
import typescriptPlugin from '@typescript-eslint/eslint-plugin';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
  globalIgnores(['**/dist/**', '**/build/**', '**/.next/**']),
  {
    files: ['packages/*/src/**/*.ts', 'eval/**/*.ts'],
    extends: [
      js.configs.recommended,
      typescriptPlugin.configs['flat/recommended-type-checked'],
    ],
    languageOptions: {
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Retain rules from the previous recommended preset.
      'no-extra-semi': 'error',
      'no-inner-declarations': 'error',
      'no-mixed-spaces-and-tabs': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-function-return-type': ['error', { allowExpressions: true }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
    },
  },
]);
