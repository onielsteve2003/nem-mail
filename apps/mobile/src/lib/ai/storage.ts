import { MODEL_CACHE, modelFileUrls, type ModelSpec } from './registry.js';

/** Bytes received so far over the bytes expected (the estimate until the server says). */
export interface DownloadProgress {
	loaded: number;
	total: number;
}

/** What storage needs from the environment; the worker passes its globals, tests pass fakes. */
export interface StorageEnv {
	caches: CacheStorage;
	fetch: typeof fetch;
}

/** True when every file of the model is in the cache. */
export async function isModelCached(model: ModelSpec, env: StorageEnv): Promise<boolean> {
	const cache = await env.caches.open(MODEL_CACHE);
	for (const url of modelFileUrls(model)) {
		if (!(await cache.match(url))) return false;
	}
	return true;
}

/**
 * Downloads every missing file of the model into the Cache API, reporting progress
 * as bytes arrive. Files already cached are skipped, so a failed download resumes per file.
 * @throws Error when a file cannot be fetched.
 */
export async function downloadModel(
	model: ModelSpec,
	env: StorageEnv,
	onProgress: (progress: DownloadProgress) => void = () => {}
): Promise<void> {
	const cache = await env.caches.open(MODEL_CACHE);
	const urls = modelFileUrls(model);
	// Spread the estimate over the files until each response gives its real size.
	const sizes = new Map(urls.map((url) => [url, model.sizeBytes / urls.length]));
	const loaded = new Map(urls.map((url) => [url, 0]));
	const report = () =>
		onProgress({ loaded: sum(loaded), total: Math.max(sum(sizes), sum(loaded)) });

	for (const url of urls) {
		const cached = await cache.match(url);
		if (cached) {
			const size = Number(cached.headers.get('content-length')) || (sizes.get(url) ?? 0);
			sizes.set(url, size);
			loaded.set(url, size);
			report();
			continue;
		}
		const response = await env.fetch(url);
		if (!response.ok || !response.body) {
			throw new Error(`Could not download ${model.name} (${response.status})`);
		}
		const length = Number(response.headers.get('content-length'));
		if (length) sizes.set(url, length);
		const chunks: Uint8Array[] = [];
		const reader = response.body.getReader();
		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;
			chunks.push(value);
			loaded.set(url, (loaded.get(url) ?? 0) + value.byteLength);
			report();
		}
		const body = concat(chunks);
		sizes.set(url, body.byteLength);
		await cache.put(
			url,
			new Response(body, {
				headers: {
					'content-type': response.headers.get('content-type') ?? 'application/octet-stream',
					'content-length': String(body.byteLength)
				}
			})
		);
		report();
	}
}

/** Removes the model's files from the cache. */
export async function deleteModel(model: ModelSpec, env: StorageEnv): Promise<void> {
	const cache = await env.caches.open(MODEL_CACHE);
	await Promise.all(modelFileUrls(model).map((url) => cache.delete(url)));
}

function concat(chunks: Uint8Array[]): Uint8Array<ArrayBuffer> {
	const body = new Uint8Array(chunks.reduce((size, chunk) => size + chunk.byteLength, 0));
	let offset = 0;
	for (const chunk of chunks) {
		body.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return body;
}

function sum(values: Map<string, number>): number {
	let total = 0;
	for (const value of values.values()) total += value;
	return total;
}
