import { proxy, wrap } from 'comlink';
import type { AIWorkerApi } from './api.js';

/** A live worker: its API plus a way to stop it. */
export interface AIWorkerConnection {
	api: AIWorkerApi;
	terminate(): void;
}

/**
 * Starts the AI worker. Imported dynamically by AIService, so neither the worker
 * nor Comlink is in the first route's bundle.
 */
export function connectWorker(): AIWorkerConnection {
	const worker = new Worker(new URL('./ai.worker.ts', import.meta.url), {
		type: 'module',
		name: 'nem-ai'
	});
	const remote = wrap<AIWorkerApi>(worker);
	return {
		api: {
			backend: () => remote.backend(),
			cachedModels: () => remote.cachedModels(),
			// Callbacks cannot be cloned to a worker; a Comlink proxy calls back across.
			download: (id, onProgress) => remote.download(id, onProgress && proxy(onProgress)),
			remove: (id) => remote.remove(id),
			classifySpam: (userId, messages) => remote.classifySpam(userId, messages),
			learnSpam: (userId, texts, isSpam) => remote.learnSpam(userId, texts, isSpam),
			classifyCategory: (userId, messages) => remote.classifyCategory(userId, messages),
			learnCategory: (userId, messages, category) =>
				remote.learnCategory(userId, messages, category),
			summarize: (messages) => remote.summarize(messages),
			smartReplies: (input) => remote.smartReplies(input),
			complete: (userId, before) => remote.complete(userId, before),
			hasComposeModel: (userId) => remote.hasComposeModel(userId),
			learnCompose: (userId, texts) => remote.learnCompose(userId, texts),
			scorePriority: (userId, inputs) => remote.scorePriority(userId, inputs),
			learnPriority: (userId, inputs, isImportant, signal) =>
				remote.learnPriority(userId, inputs, isImportant, signal)
		},
		terminate: () => worker.terminate()
	};
}
