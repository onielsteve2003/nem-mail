// Offline support (T12.1): after the first visit the whole demo runs without a network,
// since the mail data already lives in IndexedDB.
import { version } from '$app/env';
import { assets, immutable } from '$app/manifest';
import { SHELL_PATH, cacheStrategy, precacheList } from '#lib/utils/sw-cache.js';

const sw = self as unknown as ServiceWorkerGlobalScope;
const CACHE = `nem-mail-${version}`;
const ASSETS = precacheList(
	immutable.map((file) => file.path),
	assets.map((file) => file.path)
);
const PRECACHED = new Set(ASSETS);
// Module scripts send an Origin header; a server's `Vary: Origin` must not turn them into misses.
const MATCH: CacheQueryOptions = { ignoreVary: true };

sw.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(CACHE)
			.then((cache) => cache.addAll(ASSETS))
			.then(() => sw.skipWaiting())
	);
});

sw.addEventListener('activate', (event) => {
	// Drop the caches of older versions.
	event.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
			)
			.then(() => sw.clients.claim())
	);
});

async function fromNetwork(request: Request, cache: Cache): Promise<Response> {
	const response = await fetch(request);
	if (response.ok) void cache.put(request, response.clone());
	return response;
}

async function respond(request: Request, strategy: 'shell' | 'cache-first' | 'network-first') {
	const cache = await caches.open(CACHE);
	if (strategy === 'cache-first') {
		return (await cache.match(request, MATCH)) ?? fromNetwork(request, cache);
	}
	try {
		// Pages go to the network so a new deploy shows up; the shell answers when offline.
		return strategy === 'shell' ? await fetch(request) : await fromNetwork(request, cache);
	} catch (error) {
		const cached = await cache.match(strategy === 'shell' ? SHELL_PATH : request, MATCH);
		if (cached) return cached;
		throw error;
	}
}

sw.addEventListener('fetch', (event) => {
	const { request } = event;
	const strategy = cacheStrategy(
		{ method: request.method, mode: request.mode, url: new URL(request.url) },
		sw.location.origin,
		PRECACHED
	);
	if (strategy) event.respondWith(respond(request, strategy));
});
