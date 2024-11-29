/* eslint-disable import-x/no-named-as-default-member */
/* eslint-disable import-x/default */
/* eslint-disable n/no-extraneous-import */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
// @ts-check

import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'
import globals from 'globals'
import eslintConfigPrettier from 'eslint-config-prettier'
import reactPlugin from 'eslint-plugin-react'
import nodePlugin from 'eslint-plugin-n'
import eslintPluginImportX from 'eslint-plugin-import-x'
import promisePlugin from 'eslint-plugin-promise'
import hooksPlugin from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

const config = tseslint.config(
  eslint.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  tseslint.configs.recommended,
  eslintConfigPrettier,
  // @ts-expect-error does not have types
  reactPlugin.configs.flat.recommended, // This is not a plugin object, but a shareable config object
  eslintPluginImportX.flatConfigs.recommended,
  eslintPluginImportX.flatConfigs.typescript,
  // @ts-expect-error does not have types
  reactPlugin.configs.flat['jsx-runtime'], // Add this if you are using React 17+
  nodePlugin.configs['flat/recommended-module'],
  promisePlugin.configs['flat/recommended'],
  {
    plugins: {
      'react-hooks': hooksPlugin,
      'react-refresh': reactRefresh,
    },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
      },
      parserOptions: {
        projectService: {
          allowDefaultProject: ['prettier.config.cjs', 'eslint.config.js'],
          defaultProject: 'tsconfig.json',
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      ...hooksPlugin.configs.recommended.rules,
      'react/prop-types': 'off',
      'no-console': ['error', { allow: ['error'] }],
      'n/no-missing-import': 'off',
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      '@typescript-eslint/no-unnecessary-condition': ['error', { allowConstantLoopConditions: true }],
    },
  },
  {
    ignores: ['docs/**/*', 'dist/**/*'],
  }
)

export default config
