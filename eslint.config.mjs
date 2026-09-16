import js from '@eslint/js'
import nextPlugin from '@next/eslint-plugin-next'
import parser from '@typescript-eslint/parser'
export default [
  { ignores: ['.next/**','node_modules/**'] },
  { files: ['src/**/*.{ts,tsx}'], languageOptions: { parser, parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } } },
    plugins: { '@next/next': nextPlugin },
    rules: { ...js.configs.recommended.rules, ...nextPlugin.configs.recommended.rules, '@next/next/no-img-element': 'off', '@next/next/no-page-custom-font': 'off', 'no-undef': 'off', 'no-unused-vars': 'off', 'no-empty': ['error', { allowEmptyCatch: true }], 'no-dupe-class-members': 'off' } },
]
