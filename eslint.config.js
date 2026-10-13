import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import { defineConfig } from 'eslint/config';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import ts from 'typescript-eslint';

export default defineConfig(
	{
		ignores: [
			'**/build/',
			'**/dist/',
			'**/.svelte-kit/',
			'**/coverage/',
			'**/test-results/',
			'**/playwright-report/',
			'**/android/',
			'**/ios/',
			'context/'
		]
	},
	js.configs.recommended,
	ts.configs.recommended,
	svelte.configs.recommended,
	prettier,
	svelte.configs.prettier,
	{
		languageOptions: { globals: { ...globals.browser, ...globals.node } },
		// TypeScript already reports undefined identifiers, and better than this rule does.
		rules: { 'no-undef': 'off' }
	},
	{
		// Repository boundary: UI and stores use data/repositories and data/provider only,
		// never a concrete backend, so the mock-to-HTTP swap needs no UI changes.
		files: ['apps/mobile/src/**'],
		ignores: ['apps/mobile/src/lib/data/**'],
		rules: {
			'no-restricted-imports': [
				'error',
				{
					patterns: [
						{
							group: ['#lib/data/mock', '#lib/data/mock/*', '#lib/data/http', '#lib/data/http/*'],
							message: 'Import repositories through #lib/data/repositories or #lib/data/provider.'
						},
						{
							group: ['**/data/mock', '**/data/mock/*', '**/data/http', '**/data/http/*'],
							message: 'Import repositories through #lib/data/repositories or #lib/data/provider.'
						}
					]
				}
			]
		}
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		languageOptions: {
			parserOptions: {
				projectService: true,
				tsconfigRootDir: import.meta.dirname,
				extraFileExtensions: ['.svelte'],
				parser: ts.parser
			}
		}
	}
);
