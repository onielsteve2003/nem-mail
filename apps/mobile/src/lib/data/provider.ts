import { createContext } from 'svelte';
import type { AppConfig } from '#lib/config.js';
import { createHttpRepositories, notImplemented } from './http/index.js';
import { MockMailSimulator } from './mock/arrival.js';
import { MockAuthRepository } from './mock/auth.js';
import { MockContactRepository } from './mock/contacts.js';
import { MockContext, readFailRate } from './mock/context.js';
import { MockDraftRepository } from './mock/drafts.js';
import { MockLabelRepository } from './mock/labels.js';
import { MockMailRepository } from './mock/mail.js';
import { MockSearchRepository } from './mock/search.js';
import { MockSettingsRepository } from './mock/settings.js';
import type { Repositories } from './repositories.js';

/** The repositories plus the background work behind them. */
export interface DataLayer {
	repos: Repositories;
	/** Starts background work (the mock's delivery and arrival simulator). Returns a stop function. */
	start(): () => void;
	/** Checks for new mail now (pull to refresh). The mock delivers one simulated arrival. */
	sync(): Promise<void>;
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
		return {
			repos: createHttpRepositories(config.apiUrl),
			start: () => () => {},
			sync: async () => {}
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
		start() {
			simulator.start();
			return () => simulator.stop();
		},
		async sync() {
			await simulator.arrive();
		}
	};
}

/** Shares the repositories with stores and routes; set once in the root layout (T4.1). */
export const [getRepositories, setRepositories] = createContext<Repositories>();
