import { detectBackend, type AIBackend } from '../backend.js';
import {
	idbEmbeddingStore,
	idbModelStore,
	type EmbeddingStore,
	type ModelStore
} from '../model-store.js';
import type { Embed } from '../models/embedder.js';
import { dot, textHash, type SemanticDoc } from '../models/hybrid.js';
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
import {
	isLogisticModel,
	learnPriorityFeedback,
	scorePriority,
	trainPriorityModel,
	type LogisticModel,
	type PriorityInput,
	type PrioritySignal,
	type PriorityVerdict
} from '../models/priority-lr.js';
import {
	completeText,
	isNgramModel,
	learnNgram,
	trainNgramModel,
	type ComposeVerdict,
	type NgramModel
} from '../models/ngram.js';
import { extract, type ExtractInput, type ExtractionVerdict } from '../models/extract.js';
import { findModel } from '../registry.js';
import type { ClassifySentiment } from '../models/sentiment.js';
import { checkTone, type ToneVerdict } from '../models/tone.js';
import { suggestReplies, type ReplyInput, type SmartReplyVerdict } from '../models/smart-reply.js';
import type { Summarize } from '../models/summarizer.js';
import {
	ownText,
	summarizeThread,
	type SummaryMessage,
	type SummaryVerdict
} from '../models/textrank.js';
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
	/**
	 * A thread summary with action items (AI-3): TextRank, rewritten by DistilBART when
	 * it is downloaded. Null for threads too short to need one.
	 */
	summarize(messages: SummaryMessage[]): Promise<SummaryVerdict | null>;
	/** Three short replies to a message (AI-4); null for mail nobody replies to. */
	smartReplies(input: ReplyInput): Promise<SmartReplyVerdict | null>;
	/** Codes, tracking numbers, dates, and meeting times in a message (AI-10); null when none. */
	extract(input: ExtractInput): Promise<ExtractionVerdict | null>;
	/** Ghost text for the paragraph before the caret (AI-5), or null when unsure. */
	complete(userId: string, before: string): Promise<ComposeVerdict | null>;
	/** True when this user's smart compose model was trained and saved before. */
	hasComposeModel(userId: string): Promise<boolean>;
	/** Trains smart compose on sent mail text and saves the model. */
	learnCompose(userId: string, texts: string[]): Promise<void>;
	/**
	 * Tone check before sending (AI-8): the word list, plus DistilBERT SST-2 when it is
	 * downloaded. Null for an empty message.
	 */
	checkTone(text: string): Promise<ToneVerdict | null>;
	/**
	 * Meaning similarity (-1 to 1) of each thread to the query, by thread id (AI-7).
	 * Vectors are cached per thread and recomputed only when its text changes. Null
	 * when MiniLM is not downloaded.
	 */
	semanticScores(
		userId: string,
		query: string,
		docs: SemanticDoc[]
	): Promise<Record<string, number> | null>;
	/** Priority scores (AI-6) from the user's logistic regression model. */
	scorePriority(userId: string, inputs: PriorityInput[]): Promise<PriorityVerdict[]>;
	/** Learns from marking important / not important, or from opening a message, and saves. */
	learnPriority(
		userId: string,
		inputs: PriorityInput[],
		isImportant: boolean,
		signal: PrioritySignal
	): Promise<void>;
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
const SUMMARY_MODEL = 'distilbart-cnn';
const SENTIMENT_MODEL = 'distilbert-sst2';
const EMBEDDING_MODEL = 'minilm';
/** Texts per embedding call: small batches keep each call short. */
const EMBED_BATCH = 16;

/** Builds the worker API over the given storage, so tests can run it on the main thread. */
export function createWorkerApi(
	env: StorageEnv,
	ids: () => readonly string[],
	probe: () => Promise<AIBackend> = () => detectBackend(),
	store: ModelStore = idbModelStore(),
	zeroShot?: () => Promise<ZeroShot>,
	abstractive?: () => Promise<Summarize>,
	sentiment?: () => Promise<ClassifySentiment>,
	semantic: { store?: EmbeddingStore; embed?: () => Promise<Embed> } = {}
): AIWorkerApi {
	const embeddings = semantic.store ?? idbEmbeddingStore();
	let backend: Promise<AIBackend> | undefined;
	const models = new Map<string, Promise<NaiveBayesState>>();
	let priority: { userId: string; model: Promise<LogisticModel> } | undefined;
	const compose = new Map<string, Promise<{ model: NgramModel; isSaved: boolean }>>();
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
	function priorityModel(userId: string): Promise<LogisticModel> {
		if (priority?.userId !== userId) {
			const model = store
				.get(`${userId}:priority`)
				.catch(() => undefined)
				.then((saved) => (isLogisticModel(saved) ? saved : trainPriorityModel()));
			priority = { userId, model };
		}
		return priority.model;
	}
	function composeModel(userId: string) {
		let loaded = compose.get(userId);
		if (!loaded) {
			loaded = store
				.get(`${userId}:ngram`)
				.catch(() => undefined)
				.then((saved) =>
					isNgramModel(saved)
						? { model: saved, isSaved: true }
						: { model: trainNgramModel(), isSaved: false }
				);
			compose.set(userId, loaded);
		}
		return loaded;
	}
	// The zero-shot upgrade runs only when its model is downloaded (opt-in, AI settings).
	async function upgrade(): Promise<ZeroShot | null> {
		if (!(await isModelCached(model(ZERO_SHOT_MODEL), env).catch(() => false))) return null;
		if (zeroShot) return zeroShot();
		const { zeroShotClassifier } = await import('../models/zero-shot.js');
		return zeroShotClassifier(model(ZERO_SHOT_MODEL));
	}
	async function summarizer(): Promise<Summarize | null> {
		if (!(await isModelCached(model(SUMMARY_MODEL), env).catch(() => false))) return null;
		if (abstractive) return abstractive();
		const { abstractiveSummarizer } = await import('../models/summarizer.js');
		return abstractiveSummarizer(model(SUMMARY_MODEL));
	}
	async function sentimentModel(): Promise<ClassifySentiment | null> {
		if (!(await isModelCached(model(SENTIMENT_MODEL), env).catch(() => false))) return null;
		if (sentiment) return sentiment();
		const { sentimentClassifier } = await import('../models/sentiment.js');
		return sentimentClassifier(model(SENTIMENT_MODEL));
	}
	async function embedder(): Promise<Embed | null> {
		if (!(await isModelCached(model(EMBEDDING_MODEL), env).catch(() => false))) return null;
		if (semantic.embed) return semantic.embed();
		const { sentenceEmbedder } = await import('../models/embedder.js');
		return sentenceEmbedder(model(EMBEDDING_MODEL));
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
		},
		async summarize(messages) {
			const extractive = summarizeThread(messages);
			if (!extractive) return null;
			const summarize = await summarizer().catch(() => null);
			if (!summarize) return extractive;
			// The model reads every message's own words; quoted replies would repeat them.
			const text = messages.map((m) => `${m.from}: ${ownText(m.text)}`).join('\n\n');
			const written = await summarize(text).catch(() => '');
			if (!written) return extractive;
			return {
				...extractive,
				value: { ...extractive.value, text: written },
				confidence: 0.8,
				explanation:
					'DistilBART wrote this summary on this device. Action items are sentences that ask for something.'
			};
		},
		smartReplies: async (input) => suggestReplies(input),
		extract: async (input) => extract(input),
		async complete(userId, before) {
			return completeText((await composeModel(userId)).model, before);
		},
		async checkTone(text) {
			if (!text.trim()) return null;
			const classify = await sentimentModel().catch(() => null);
			// A model that fails to load or run leaves the word list check, never no check.
			const read = classify ? await classify(text).catch(() => null) : null;
			return checkTone(text, read);
		},
		async semanticScores(userId, query, docs) {
			const embed = await embedder();
			if (!embed) return null;
			const keys = docs.map((doc) => `${userId}:${doc.id}`);
			const hashes = docs.map((doc) => textHash(doc.text));
			// A broken cache only costs recomputing; it never stops the search.
			const cached = await embeddings.getMany(keys).catch(() => keys.map(() => undefined));
			const vectors = cached.map((entry, i) =>
				entry && entry.hash === hashes[i] ? entry.vector : undefined
			);
			const missing = docs.flatMap((_, i) => (vectors[i] ? [] : [i]));
			for (let start = 0; start < missing.length; start += EMBED_BATCH) {
				const batch = missing.slice(start, start + EMBED_BATCH);
				const fresh = await embed(batch.map((i) => docs[i]?.text ?? ''));
				batch.forEach((i, j) => (vectors[i] = fresh[j]));
				await embeddings
					.putMany(
						batch.flatMap((i) => {
							const vector = vectors[i];
							return vector ? [[keys[i] ?? '', { hash: hashes[i] ?? '', vector }] as const] : [];
						}) as [string, { hash: string; vector: number[] }][]
					)
					.catch(() => {});
			}
			const [target] = await embed([query]);
			if (!target) return {};
			return Object.fromEntries(
				docs.map((doc, i) => [doc.id, Math.round(dot(target, vectors[i] ?? []) * 1000) / 1000])
			);
		},
		hasComposeModel: async (userId) => (await composeModel(userId)).isSaved,
		async learnCompose(userId, texts) {
			const loaded = await composeModel(userId);
			for (const text of texts) learnNgram(loaded.model, text);
			await store.put(`${userId}:ngram`, loaded.model);
			loaded.isSaved = true;
		},
		async scorePriority(userId, inputs) {
			const model = await priorityModel(userId);
			return inputs.map((input) => scorePriority(model, input));
		},
		async learnPriority(userId, inputs, isImportant, signal) {
			const model = await priorityModel(userId);
			for (const input of inputs) learnPriorityFeedback(model, input, isImportant, signal);
			await store.put(`${userId}:priority`, model);
		}
	};
}
