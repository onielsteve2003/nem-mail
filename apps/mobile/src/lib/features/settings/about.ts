import { MODELS } from '#lib/ai/registry.js';
import { THEME_STORAGE_KEY } from '#lib/utils/theme.js';

export interface Credit {
	name: string;
	license: string;
	/** What Nem Mail uses it for. */
	use: string;
}

/** Open-source code shipped in the app, one entry per runtime dependency. */
export const PACKAGE_CREDITS: readonly Credit[] = [
	{ name: 'svelte', license: 'MIT', use: 'UI framework' },
	{ name: '@sveltejs/kit', license: 'MIT', use: 'Routing and build' },
	{ name: '@ionic/core', license: 'MIT', use: 'Platform primitives (menu, refresher)' },
	{ name: '@capacitor/core', license: 'MIT', use: 'Native app bridge' },
	{ name: '@capacitor/android', license: 'MIT', use: 'Android app' },
	{ name: '@capacitor/app', license: 'MIT', use: 'Back button and app state' },
	{ name: '@capacitor/haptics', license: 'MIT', use: 'Haptic feedback' },
	{ name: '@capacitor/keyboard', license: 'MIT', use: 'On-screen keyboard events' },
	{ name: '@capacitor/local-notifications', license: 'MIT', use: 'New-mail alerts' },
	{ name: '@capacitor/share', license: 'MIT', use: 'System share sheet' },
	{ name: '@capacitor/splash-screen', license: 'MIT', use: 'Native launch screen' },
	{ name: '@capacitor/status-bar', license: 'MIT', use: 'Status bar style' },
	{ name: '@huggingface/transformers', license: 'Apache-2.0', use: 'On-device transformer models' },
	{ name: 'comlink', license: 'Apache-2.0', use: 'Talking to the AI worker' },
	{ name: 'dompurify', license: 'MPL-2.0 OR Apache-2.0', use: 'Safe email HTML' },
	{ name: 'idb', license: 'ISC', use: 'IndexedDB storage' },
	{ name: 'zod', license: 'MIT', use: 'Data contracts' },
	{ name: '@lucide/svelte', license: 'ISC', use: 'Icons' },
	{ name: '@fontsource-variable/inter', license: 'OFL-1.1', use: 'Body font' },
	{ name: '@fontsource-variable/space-grotesk', license: 'OFL-1.1', use: 'Display font' }
];

/** Optional AI models, credited from the registry so the two never drift. */
export const MODEL_CREDITS: readonly Credit[] = MODELS.map((model) => ({
	name: `${model.name} (${model.repo})`,
	license: model.license,
	use: model.purpose
}));

export interface StackGroup {
	title: string;
	items: { name: string; detail: string }[];
}

/** The tech-stack showcase (portfolio): what each part is built with and why. */
export const STACK: readonly StackGroup[] = [
	{
		title: 'Frontend',
		items: [
			{ name: 'Svelte 5 + SvelteKit', detail: 'Runes for state, static SPA build for web and app' },
			{ name: 'TypeScript (strict)', detail: 'One set of types from data to UI' },
			{ name: 'Ionic core', detail: 'Native-grade menu and pull to refresh, with our own look' },
			{ name: 'Aurora Noir', detail: 'Hand-made design system: tokens, vanilla CSS, two themes' }
		]
	},
	{
		title: 'On-device AI',
		items: [
			{
				name: 'Classic models from scratch',
				detail:
					'Naive Bayes spam and categories, logistic regression priority, n-gram compose, TextRank'
			},
			{
				name: 'Transformers.js',
				detail: 'Optional MiniLM, DistilBERT, MobileBERT and DistilBART, downloaded on opt-in'
			},
			{ name: 'Web Worker + Comlink', detail: 'Models never block scrolling or typing' }
		]
	},
	{
		title: 'Data',
		items: [
			{ name: 'Repository pattern', detail: 'Mock now, HTTP later, with no UI changes' },
			{ name: 'IndexedDB mock backend', detail: 'Seeded mail, latency and error injection' },
			{ name: 'Zod contracts', detail: 'Shared schemas the server will mirror' }
		]
	},
	{
		title: 'Mobile',
		items: [
			{ name: 'Capacitor', detail: 'Android build; iOS project prepared' },
			{ name: 'PWA', detail: 'Add to Home Screen on iPhone' }
		]
	},
	{
		title: 'Backend (Phase 2)',
		items: [
			{ name: 'Java 25 + Spring Boot 4', detail: 'REST API on virtual threads' },
			{ name: 'PostgreSQL + pgvector', detail: 'Flyway migrations, full-text and semantic search' }
		]
	},
	{
		title: 'Quality',
		items: [
			{ name: 'Vitest + Testing Library', detail: 'Unit, component and model accuracy tests' },
			{ name: 'Playwright', detail: 'End-to-end flows on phone viewports' },
			{ name: 'GitHub Actions + Vercel', detail: 'CI on every push, live demo deploys' }
		]
	}
];

/** localStorage keys the app writes; Reset demo data clears them with the mail. */
export function isAppStorageKey(key: string): boolean {
	return key.startsWith('nem-mail:') || key === THEME_STORAGE_KEY;
}
