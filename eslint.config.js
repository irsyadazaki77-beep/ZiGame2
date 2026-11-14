import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import { flatRecommended as firebaseSecurityRulesRecommended } from '@firebase/eslint-plugin-security-rules';

export default tseslint.config(
  { ignores: ['dist', 'dev-dist', 'node_modules'] },
  firebaseSecurityRulesRecommended,
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'no-useless-escape': 'off',
      'no-empty': 'off',
      '@typescript-eslint/no-namespace': 'off',
      'no-useless-assignment': 'off'
    },
  }
);

