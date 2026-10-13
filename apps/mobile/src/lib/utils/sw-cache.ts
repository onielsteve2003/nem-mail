// The app shell: an SPA, so every route is served by the same index.html.
export const SHELL_PATH = '/';

// Large, install-time-only files (iOS launch images) that iOS fetches itself.
const SKIP_PRECACHE_PREFIX = '/icons/splash/';

export type CacheStrategy = 'shell' | 'cache-first' | 'network-first';

/** The files the service worker stores at install: the build, the static files and the shell. */
export function precacheList(build: string[], files: string[]): string[] {
	const statics = files.map(toRootPath).filter((path) => !path.startsWith(SKIP_PRECACHE_PREFIX));
	return [...new Set([...build.map(toRootPath), ...statics, SHELL_PATH])];
}

// `$app/manifest` paths are relative to the base path, which is the site root here.
function toRootPath(path: string): string {
	return path.startsWith('/') ? path : `/${path}`;
}

interface RequestInfo {
	method: string;
	mode: string;
	url: URL;
}

/**
 * How the service worker answers a request, or null to leave it to the network.
 * Page loads get the cached shell when offline; precached files come from the cache;
 * other same-origin GETs try the network first and fall back to the cache.
 * Cross-origin requests (AI model downloads) are left alone; Transformers.js caches them itself.
 */
export function cacheStrategy(
	request: RequestInfo,
	origin: string,
	precached: ReadonlySet<string>
): CacheStrategy | null {
	if (request.method !== 'GET' || request.url.origin !== origin) return null;
	if (request.mode === 'navigate') return 'shell';
	if (precached.has(request.url.pathname)) return 'cache-first';
	return 'network-first';
}
