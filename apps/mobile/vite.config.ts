/// <reference types="vitest/config" />
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { svelteTesting } from '@testing-library/svelte/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			// SPA mode: one static build serves the web demo, the PWA and Capacitor's webDir.
			adapter: adapter({ pages: 'build', assets: 'build', fallback: 'index.html', strict: true })
		}),
		// Resolves Svelte's browser build under Vitest and cleans up the DOM after each test.
		svelteTesting()
	],
	// The AI worker is a module worker; ES output lets its heavy, optional parts
	// (Transformers.js for the zero-shot upgrade) stay in chunks loaded on first use.
	worker: { format: 'es' },
	test: {
		environment: 'jsdom',
		include: ['src/**/*.test.ts'],
		setupFiles: ['./vitest-setup.ts'],
		coverage: {
			provider: 'v8',
			include: ['src/**/*.{ts,svelte}'],
			exclude: ['src/**/*.test.ts', 'src/app.d.ts']
		}
	}
});
