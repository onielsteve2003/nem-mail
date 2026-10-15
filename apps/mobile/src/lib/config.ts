import { PUBLIC_API_URL, PUBLIC_APP_VERSION, PUBLIC_DATA_SOURCE } from '$app/env/public';
import type { DataSource } from '../env.js';

export type { DataSource };

/** Typed app configuration. Read it from here, never from `$app/env/public` directly. */
export interface AppConfig {
	dataSource: DataSource;
	/** API base URL without a trailing slash; empty when running on mock data. */
	apiUrl: string;
	appVersion: string;
}

/**
 * Builds the app config from validated env values and checks rules that span variables.
 * An unset data source means the API when there is an API URL, else the mock (Phase 2 default).
 * @throws Error when the API data source is chosen without an API URL.
 */
export function createConfig(env: {
	dataSource: DataSource | '';
	apiUrl: string;
	appVersion: string;
}): AppConfig {
	const dataSource = env.dataSource || (env.apiUrl ? 'api' : 'mock');
	if (dataSource === 'api' && !env.apiUrl) {
		throw new Error('PUBLIC_API_URL is required when PUBLIC_DATA_SOURCE is "api"');
	}
	return Object.freeze({ ...env, dataSource });
}

export const config: AppConfig = createConfig({
	dataSource: PUBLIC_DATA_SOURCE,
	apiUrl: PUBLIC_API_URL,
	appVersion: PUBLIC_APP_VERSION
});
