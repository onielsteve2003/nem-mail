import { detectBackend, type AIBackend } from '../backend.js';
import { idbModelStore, type ModelStore } from '../model-store.js';
import type { Category } from '@nem/shared';
import {
	classifyCategory,
	LOW_CONFIDENCE,
	learnCategoryFeedback,
	tabName,
	trainCategoryModel,
	type CategoryInput,
	type CategoryModel,
	type CategoryVerdict
} from '../models/category.js';
import type { NaiveBayesState } from '../models/naive-bayes.js';
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
	/** Inbox tab for messages (AI-1): rules + Naive Bayes, zero-shot when downloaded. */
	classifyCategory(userId: string, messages: CategoryInput[]): Promise<CategoryVerdict[]>;
	/** Learns from "Move to tab" and saves the model. */
	learnCategory(userId: string, messages: CategoryInput[], category: Category): Promise<void>;
}

/** Runs the optional zero-shot model; tests pass their own. */
export type ZeroShot = (text: string) => Promise<{ category: Category; score: number }>;

function isNaiveBayes(value: unknown): value is NaiveBayesState {
	return (
		typeof value === 'object' &&
		value !== null &&
		(value as NaiveBayesState).version === 1 &&
		typeof (value as NaiveBayesState).counts === 'object'
	);
}

const ZERO_SHOT_MODEL = 'mobilebert-mnli';

/** Builds the worker API over the given storage, so tests can run it on the main thread. */
export function createWorkerApi(
	env: StorageEnv,
	ids: () => readonly string[],
	probe: () => Promise<AIBackend> = () => detectBackend(),
	store: ModelStore = idbModelStore(),
	zeroShot?: () => Promise<ZeroShot>
): AIWorkerApi {
	let backend: Promise<AIBackend> | undefined;
	const models = new Map<string, Promise<NaiveBayesState>>();
	const model = (id: string) => {
		const spec = findModel(id);
		if (!spec) throw new Error(`Unknown model "${id}"`);
		return spec;
	};
	// A saved model carries the user's lessons; without one, train on the seed corpus.
	function learned<M extends NaiveBayesState>(key: string, train: () => M): Promise<M> {
		let loaded = models.get(key);
		if (!loaded) {
			loaded = store
				.get(key)
				.catch(() => undefined)
				.then((saved) => (isNaiveBayes(saved) ? saved : train()));
			models.set(key, loaded);
		}
		return loaded as Promise<M>;
	}
	const spamModel = (userId: string) => learned<SpamModel>(`${userId}:spam`, trainSpamModel);
	const categoryModel = (userId: string) =>
		learned<CategoryModel>(`${userId}:category`, trainCategoryModel);
	// The zero-shot upgrade runs only when its model is downloaded (opt-in, AI settings).
	async function upgrade(): Promise<ZeroShot | null> {
		if (!(await isModelCached(model(ZERO_SHOT_MODEL), env).catch(() => false))) return null;
		if (zeroShot) return zeroShot();
		const { zeroShotClassifier } = await import('../models/zero-shot.js');
		return zeroShotClassifier(model(ZERO_SHOT_MODEL));
	}
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
		},
		async classifyCategory(userId, messages) {
			const category = await categoryModel(userId);
			const verdicts = messages.map((message) => classifyCategory(category, message));
			if (!verdicts.some((v) => v.source === 'model' && v.confidence < LOW_CONFIDENCE)) {
				return verdicts;
			}
			const classify = await upgrade().catch(() => null);
			if (!classify) return verdicts;
			return Promise.all(
				verdicts.map(async (verdict, i) => {
					const message = messages[i];
					if (!message || verdict.source !== 'model' || verdict.confidence >= LOW_CONFIDENCE) {
						return verdict;
					}
					const { category: value, score } = await classify(
						`${message.subject}. ${message.bodyText}`
					);
					if (score <= verdict.confidence) return verdict;
					return {
						value,
						confidence: Math.round(score * 100) / 100,
						explanation: `The on-device language model reads it as ${tabName(value)} mail.`,
						source: 'model' as const
					};
				})
			);
		},
		async learnCategory(userId, messages, target) {
			const category = await categoryModel(userId);
			for (const message of messages) learnCategoryFeedback(category, message, target);
			await store.put(`${userId}:category`, category);
		}
	};
}
