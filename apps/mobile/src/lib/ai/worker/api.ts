import { detectBackend, type AIBackend } from '../backend.js';
import { idbModelStore, type ModelStore } from '../model-store.js';
import type { PhishingInput } from '../models/phishing.js';
import {
	classifySpam,
	learnSpamFeedback,
	trainSpamModel,
	type SpamModel,
	type SpamVerdict
} from '../models/spam-nb.js';
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
	/** Spam verdicts for messages, with the user's own spam model (AI-2). */
	classifySpam(userId: string, messages: PhishingInput[]): Promise<SpamVerdict[]>;
	/** Learns from "Report spam" / "Not spam" and saves the model. */
	learnSpam(userId: string, texts: string[], isSpam: boolean): Promise<void>;
}

function isSpamModel(value: unknown): value is SpamModel {
	return (
		typeof value === 'object' &&
		value !== null &&
		(value as SpamModel).version === 1 &&
		typeof (value as SpamModel).counts === 'object'
	);
}

/** Builds the worker API over the given storage, so tests can run it on the main thread. */
export function createWorkerApi(
	env: StorageEnv,
	ids: () => readonly string[],
	probe: () => Promise<AIBackend> = () => detectBackend(),
	store: ModelStore = idbModelStore()
): AIWorkerApi {
	let backend: Promise<AIBackend> | undefined;
	const spamModels = new Map<string, Promise<SpamModel>>();
	const model = (id: string) => {
		const spec = findModel(id);
		if (!spec) throw new Error(`Unknown model "${id}"`);
		return spec;
	};
	// A saved model carries the user's lessons; without one, train on the seed corpus.
	const spamModel = (userId: string) => {
		let loaded = spamModels.get(userId);
		if (!loaded) {
			loaded = store
				.get(`${userId}:spam`)
				.catch(() => undefined)
				.then((saved) => (isSpamModel(saved) ? saved : trainSpamModel()));
			spamModels.set(userId, loaded);
		}
		return loaded;
	};
	return {
		backend: () => (backend ??= probe()),
		async cachedModels() {
			const cached: string[] = [];
			for (const id of ids()) if (await isModelCached(model(id), env)) cached.push(id);
			return cached;
		},
		download: (id, onProgress) => downloadModel(model(id), env, onProgress),
		remove: (id) => deleteModel(model(id), env),
		async classifySpam(userId, messages) {
			const spam = await spamModel(userId);
			return messages.map((message) => classifySpam(spam, message));
		},
		async learnSpam(userId, texts, isSpam) {
			const spam = await spamModel(userId);
			for (const text of texts) learnSpamFeedback(spam, text, isSpam);
			await store.put(`${userId}:spam`, spam);
		}
	};
}
