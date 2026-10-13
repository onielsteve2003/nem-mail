import { defineEnvVars } from '@sveltejs/kit/env';
import pkg from '../package.json' with { type: 'json' };

export const DATA_SOURCES = ['mock', 'api'] as const;
export type DataSource = (typeof DATA_SOURCES)[number];

// The release version from package.json, unless PUBLIC_APP_VERSION overrides it.
const DEFAULT_APP_VERSION = pkg.version;

/** Treats a missing or blank variable as unset, so an empty line in .env falls back to the default. */
function blankToUndefined(value: string | undefined): string | undefined {
	const trimmed = value?.trim();
	return trimmed ? trimmed : undefined;
}

// All variables are public and static: the SPA build has no server, so values are inlined at build time.
export const variables = defineEnvVars({
	PUBLIC_DATA_SOURCE: {
		public: true,
		static: true,
		description: 'Where mail data comes from: "mock" (Phase 1) or "api" (Phase 2).',
		schema: (value): DataSource => {
			const source = blankToUndefined(value) ?? 'mock';
			if (!(DATA_SOURCES as readonly string[]).includes(source)) {
				throw new Error(`PUBLIC_DATA_SOURCE must be one of ${DATA_SOURCES.join(', ')}`);
			}
			return source as DataSource;
		}
	},
	PUBLIC_API_URL: {
		public: true,
		static: true,
		description: 'Base URL of the Phase 2 API. Required when PUBLIC_DATA_SOURCE is "api".',
		schema: (value): string => {
			const url = blankToUndefined(value);
			if (url === undefined) return '';
			if (!URL.canParse(url)) throw new Error('PUBLIC_API_URL must be an absolute URL');
			return url.replace(/\/+$/, '');
		}
	},
	PUBLIC_APP_VERSION: {
		public: true,
		static: true,
		description: 'Version shown on the About page.',
		schema: (value): string => blankToUndefined(value) ?? DEFAULT_APP_VERSION
	}
});
