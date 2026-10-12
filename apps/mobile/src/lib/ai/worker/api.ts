import { detectBackend, type AIBackend } from '../backend.js';
import { findModel } from '../registry.js';
import {
	deleteModel,
	downloadModel,
	isModelCached,
	type DownloadProgress,
	type StorageEnv
} from '../storage.js';

/** What the AI worker exposes over Comlink. Every method is async across the thread boundary. */
export interface AIWorkerApi {
	/** The backend transformer models would run on in this worker. */
	backend(): Promise<AIBackend>;
	/** IDs of the registry models that are fully downloaded. */
	cachedModels(): Promise<string[]>;
	/** Downloads a model into the cache; `onProgress` is a Comlink proxy from the page. */
	download(id: string, onProgress?: (progress: DownloadProgress) => void): Promise<void>;
	remove(id: string): Promise<void>;
}

/** Builds the worker API over the given storage, so tests can run it on the main thread. */
export function createWorkerApi(
	env: StorageEnv,
	ids: () => readonly string[],
	probe: () => Promise<AIBackend> = () => detectBackend()
): AIWorkerApi {
	let backend: Promise<AIBackend> | undefined;
	const model = (id: string) => {
		const spec = findModel(id);
		if (!spec) throw new Error(`Unknown model "${id}"`);
		return spec;
	};
	return {
		backend: () => (backend ??= probe()),
		async cachedModels() {
			const cached: string[] = [];
			for (const id of ids()) if (await isModelCached(model(id), env)) cached.push(id);
			return cached;
		},
		download: (id, onProgress) => downloadModel(model(id), env, onProgress),
		remove: (id) => deleteModel(model(id), env)
	};
}
