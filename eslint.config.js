import js from '@eslint/js';

export default [
  {
    ignores: ['dist/**', 'node_modules/**', '.tmp-frontend-tests/**', 'coverage/**', 'backend/app/__pycache__/**', 'backend/tests/__pycache__/**'],
  },
  js.configs.recommended,
  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        setTimeout: 'readonly',
        fetch: 'readonly',
      },
    },
    rules: {
      'no-console': 'off',
    },
  },
];
