import { createContext } from 'svelte';
import type { AppConfig } from '#lib/config.js';
import { createHttpBackend, notImplemented } from './http/index.js';
import { waitForServer } from './http/wake.js';
import { MockMailSimulator } from './mock/arrival.js';
import { MockAuthRepository } from './mock/auth.js';
import { MockContactRepository } from './mock/contacts.js';
import { MockContext, readFailRate } from './mock/context.js';
import { resetToSeed } from './mock/db.js';
import { MockDraftRepository } from './mock/drafts.js';
import { MockLabelRepository } from './mock/labels.js';
import { MockMailRepository } from './mock/mail.js';
import { MockSearchRepository } from './mock/search.js';
import { MockSettingsRepository } from './mock/settings.js';
import type { Repositories } from './repositories.js';

/** The repositories plus the background work behind them. */
export interface DataLayer {
	repos: Repositories;
	/**
	 * Resolves once the backend can answer: the API's `/health` (it may be waking from sleep),
	 * at once for the mock. Rejects only when `signal` aborts.
	 */
	wake(signal?: AbortSignal): Promise<void>;
	/** Starts background work (the mock's simulator; the API's offline queue replay). Returns a stop function. */
	start(): () => void;
	/** Checks for new mail now (pull to refresh). The mock delivers one simulated arrival; the API replays queued changes. */
	sync(): Promise<void>;
	/** Puts the demo data back to the seed (Settings → About). The caller reloads the app. */
	resetDemo(): Promise<void>;
}

export interface DataLayerOptions {
	/** The page's query string; mock mode reads `?fail=0.1` from it. */
	search?: string;
	/** Mock mode only: overrides for tests (database, latency, clock). */
	mock?: ConstructorParameters<typeof MockContext>[0];
}

/** Picks the mock (Phase 1) or HTTP (Phase 2) repositories from `PUBLIC_DATA_SOURCE`. */
export function createRepositories(
	config: Pick<AppConfig, 'dataSource' | 'apiUrl'>,
	options: DataLayerOptions = {}
): DataLayer {
	if (config.dataSource === 'api') {
		const { repos, queue } = createHttpBackend(config.apiUrl);
		return {
			repos,
			wake: (signal) => waitForServer(config.apiUrl, { signal }),
			start() {
				const flush = () => void queue.flush();
				flush();
				window.addEventListener('online', flush);
				return () => window.removeEventListener('online', flush);
			},
			async sync() {
				await queue.flush();
			},
			// The server resets the demo nightly (T20.x); there is no per-user reset.
			resetDemo: async () => {
				throw new Error('Reset demo data works only on demo data.');
			}
		};
	}
	const ctx = new MockContext({ failRate: readFailRate(options.search ?? ''), ...options.mock });
	const simulator = new MockMailSimulator(ctx);
	return {
		repos: {
			auth: new MockAuthRepository(ctx),
			mail: new MockMailRepository(ctx),
			labels: new MockLabelRepository(ctx),
			drafts: new MockDraftRepository(ctx),
			contacts: new MockContactRepository(ctx),
			settings: new MockSettingsRepository(ctx),
			search: new MockSearchRepository(ctx),
			// Phase 1 AI runs on-device (T10.1), not through a repository.
			ai: notImplemented('MockAIRepository')
		},
		wake: async () => {},
		start() {
			simulator.start();
			return () => simulator.stop();
		},
		async sync() {
			await simulator.arrive();
		},
		async resetDemo() {
			simulator.stop();
			await resetToSeed(await ctx.db());
		}
	};
}

const OFFLINE_DEMO_KEY = 'nem-mail:offline-demo';

/**
 * Switches this tab to the offline demo (mock data) when the API is slow to wake, then reloads.
 * Kept in sessionStorage, so a new visit tries the server again.
 */
export function switchToOfflineDemo(): void {
	try {
		sessionStorage.setItem(OFFLINE_DEMO_KEY, '1');
	} catch {
		return;
	}
	location.reload();
}

/** The config with the offline demo choice applied. */
export function withOfflineDemo<C extends Pick<AppConfig, 'dataSource'>>(config: C): C {
	try {
		if (sessionStorage.getItem(OFFLINE_DEMO_KEY)) return { ...config, dataSource: 'mock' };
	} catch {
		// Storage blocked: stay on the configured source.
	}
	return config;
}

/** Shares the repositories with stores and routes; set once in the root layout (T4.1). */
export const [getRepositories, setRepositories] = createContext<Repositories>();

/** Shares the whole data layer, for the few screens that need more than repositories. */
export const [getDataLayer, setDataLayer] = createContext<DataLayer>();
