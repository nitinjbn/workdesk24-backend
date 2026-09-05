import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';

export default [
  {
    ignores: ['node_modules/**', 'dist/**', 'build/**'],
  },

  eslint.configs.recommended,

  ...tseslint.configs.recommended,

  {
    files: ['**/*.{ts,tsx}'],

    rules: {
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      'no-unused-vars': 'off',
      'no-explicit-any': 'off',
      'prefer-const': 'off',
      'no-useless-catch': 'off',
      '@typescript-eslint/no-unnecessary-try-catch': 'off',
      'no-self-assign': 'off',

      'no-multiple-empty-lines': [
        'error',
        {
          max: 1,
          maxEOF: 0,
          maxBOF: 0,
        },
      ],
    },
  },

  // Disable ESLint formatting rules that conflict with Prettier
  prettierConfig,
];
