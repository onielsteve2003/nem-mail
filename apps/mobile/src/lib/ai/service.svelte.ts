import {
	DEFAULT_SETTINGS,
	type AIFeature,
	type Category,
	type Message,
	type Settings,
	type Thread,
	type ThreadSummary
} from '@nem/shared';
import { createContext } from 'svelte';
import type { ContactRepository, SettingsRepository } from '#lib/data/repositories.js';
import type { AIBackend } from './backend.js';
import type { CategoryVerdict } from './models/category.js';
import type { PrioritySignal, PriorityVerdict } from './models/priority-lr.js';
import type { SpamVerdict } from './models/spam-nb.js';
import type { SummaryVerdict } from './models/textrank.js';
import { priorityInput, senderFrequencies } from './priority-input.js';
import { MODELS } from './registry.js';
import type { AIWorkerConnection } from './worker/connect.js';

export type AIToggles = Settings['ai'];

/** The signed-in user, as the priority model sees them. */
export interface AIUser {
	id: string;
	email: string;
}

const YOU = 'You';
const DOWNLOAD_FAILED = 'Download failed. Check your connection and try again.';

/** Where one optional model stands on this device. */
export interface ModelState {
	status: 'unknown' | 'absent' | 'downloading' | 'ready' | 'error';
	/** 0 to 1 while downloading. */
	progress: number;
	error: string | null;
}

/** Starts the worker on first use; tests pass an in-thread one. */
export type ConnectWorker = () => Promise<AIWorkerConnection>;

const connectDefault: ConnectWorker = async () =>
	(await import('./worker/connect.js')).connectWorker();

/**
 * The facade every AI feature goes through (architecture §3). It owns the worker,
 * which starts only when something first needs it, the feature flags from Settings,
 * and the download state of the optional models for the model manager.
 */
export class AIService {
	backend = $state<AIBackend | 'unknown'>('unknown');
	toggles = $state<AIToggles>({ ...DEFAULT_SETTINGS.ai });
	models = $state<Record<string, ModelState>>(
		Object.fromEntries(
			MODELS.map((model) => [model.id, { status: 'unknown', progress: 0, error: null }])
		)
	);

	/** Spam verdicts by message id (architecture �5: insights keyed by message). */
	spam = $state<Record<string, SpamVerdict>>({});
	/** Inbox tab verdicts by message id. */
	categories = $state<Record<string, CategoryVerdict>>({});
	/** Thread summaries by thread id, with the message count they cover (AI-3). */
	summaries = $state<Record<string, { count: number; verdict: SummaryVerdict | null }>>({});
	/** Priority scores by thread id (AI-6). */
	priority = $state<Record<string, PriorityVerdict>>({});

	#connection: Promise<AIWorkerConnection> | undefined;
	#frequencies: Promise<ReadonlyMap<string, number>> | undefined;

	constructor(
		private readonly settings: SettingsRepository | null = null,
		private readonly connect: ConnectWorker = connectDefault,
		private readonly contacts: ContactRepository | null = null
	) {}

	/** True when the user has the feature on in Settings (all are on by default). */
	isEnabled(feature: AIFeature): boolean {
		return this.toggles[feature];
	}

	/** Reads the feature flags from saved settings; keeps the defaults when that fails. */
	async loadToggles(): Promise<void> {
		if (!this.settings) return;
		try {
			this.toggles = { ...(await this.settings.get()).ai };
		} catch {
			// Settings are unavailable (signed out, storage blocked): every feature stays on.
		}
	}

	/** Detects the backend and which models are downloaded, for the model manager. */
	async refresh(): Promise<void> {
		const { api } = await this.#worker();
		const [backend, cached] = await Promise.all([api.backend(), api.cachedModels()]);
		this.backend = backend;
		for (const [id, state] of Object.entries(this.models)) {
			if (state.status === 'downloading') continue;
			this.models[id] = {
				status: cached.includes(id) ? 'ready' : 'absent',
				progress: cached.includes(id) ? 1 : 0,
				error: null
			};
		}
	}

	/** Downloads a model with live progress. Failures land in its state, not as a throw. */
	async download(id: string): Promise<void> {
		if (this.models[id]?.status === 'downloading') return;
		this.models[id] = { status: 'downloading', progress: 0, error: null };
		try {
			const { api } = await this.#worker();
			await api.download(id, ({ loaded, total }) => {
				const state = this.models[id];
				if (state && total > 0) state.progress = Math.min(loaded / total, 1);
			});
			this.models[id] = { status: 'ready', progress: 1, error: null };
		} catch {
			this.models[id] = { status: 'error', progress: 0, error: DOWNLOAD_FAILED };
		}
	}

	/** Deletes a downloaded model to free space. */
	async remove(id: string): Promise<void> {
		const { api } = await this.#worker();
		await api.remove(id);
		this.models[id] = { status: 'absent', progress: 0, error: null };
	}

	/**
	 * Classifies a message with the user's spam model and remembers the verdict.
	 * Null when the user turned spam detection off. Throws when the worker fails.
	 */
	async classifySpam(userId: string, message: Message): Promise<SpamVerdict | null> {
		if (!this.isEnabled('spam')) return null;
		const cached = this.spam[message.id];
		if (cached) return cached;
		const { api } = await this.#worker();
		const [verdict] = await api.classifySpam(userId, [spamInput(message)]);
		if (!verdict) return null;
		this.spam[message.id] = verdict;
		return verdict;
	}

	/** Teaches the user's spam model from "Report spam" (true) or "Not spam" (false). */
	async learnSpam(userId: string, messages: Message[], isSpam: boolean): Promise<void> {
		if (!this.isEnabled('spam') || messages.length === 0) return;
		const { api } = await this.#worker();
		await api.learnSpam(userId, messages.map(spamText), isSpam);
		// The model changed, so earlier verdicts may be stale.
		this.spam = {};
	}

	/**
	 * Picks the inbox tab for a message with the user's category model (AI-1).
	 * Null when the user turned smart categories off.
	 */
	async classifyCategory(userId: string, message: Message): Promise<CategoryVerdict | null> {
		if (!this.isEnabled('categories')) return null;
		const cached = this.categories[message.id];
		if (cached) return cached;
		const { api } = await this.#worker();
		const [verdict] = await api.classifyCategory(userId, [categoryInput(message)]);
		if (!verdict) return null;
		this.categories[message.id] = verdict;
		return verdict;
	}

	/** Teaches the user's category model from "Move to tab". */
	async learnCategory(userId: string, messages: Message[], category: Category): Promise<void> {
		if (!this.isEnabled('categories') || messages.length === 0) return;
		const { api } = await this.#worker();
		await api.learnCategory(userId, messages.map(categoryInput), category);
		this.categories = {};
	}

	/**
	 * Summarizes a thread with action items (AI-3). Null when the user turned summaries
	 * off or the thread is too short to need one. A new message makes a new summary.
	 */
	async summarize(thread: Thread, selfEmail: string): Promise<SummaryVerdict | null> {
		if (!this.isEnabled('summary')) return null;
		const cached = this.summaries[thread.id];
		if (cached?.count === thread.messages.length) return cached.verdict;
		const self = selfEmail.toLowerCase();
		const messages = thread.messages.map((message) => ({
			from:
				message.from.email.toLowerCase() === self ? YOU : message.from.name || message.from.email,
			text: message.bodyText
		}));
		const { api } = await this.#worker();
		const verdict = await api.summarize(messages);
		this.summaries[thread.id] = { count: thread.messages.length, verdict };
		return verdict;
	}

	/**
	 * Scores threads for the priority inbox (AI-6) and remembers the scores by thread id.
	 * Already-scored threads are skipped. Null when the user turned priority off.
	 */
	async scorePriority(
		user: AIUser,
		threads: readonly (ThreadSummary | Thread)[]
	): Promise<Record<string, PriorityVerdict> | null> {
		if (!this.isEnabled('priority')) return null;
		const fresh = threads.filter((thread) => !this.priority[thread.id]);
		if (fresh.length > 0) {
			const inputs = await this.#priorityInputs(user, fresh);
			const { api } = await this.#worker();
			const verdicts = await api.scorePriority(user.id, inputs);
			fresh.forEach((thread, i) => {
				const verdict = verdicts[i];
				if (verdict) this.priority[thread.id] = verdict;
			});
		}
		return this.priority;
	}

	/** Teaches the priority model: marking important / not important, or opening a thread. */
	async learnPriority(
		user: AIUser,
		threads: readonly (ThreadSummary | Thread)[],
		isImportant: boolean,
		signal: PrioritySignal
	): Promise<void> {
		if (!this.isEnabled('priority') || threads.length === 0) return;
		const inputs = await this.#priorityInputs(user, threads);
		const { api } = await this.#worker();
		await api.learnPriority(user.id, inputs, isImportant, signal);
		// An open nudges the model only slightly; rescoring the inbox for it is not worth it.
		if (signal === 'mark') this.priority = {};
	}

	/** Forgets verdicts, e.g. after switching accounts. */
	clearInsights(): void {
		this.spam = {};
		this.categories = {};
		this.priority = {};
		this.summaries = {};
		this.#frequencies = undefined;
	}

	async #priorityInputs(user: AIUser, threads: readonly (ThreadSummary | Thread)[]) {
		const frequencies = await this.#senderFrequencies();
		return threads.map((thread) => priorityInput(thread, user.email, frequencies));
	}

	#senderFrequencies(): Promise<ReadonlyMap<string, number>> {
		this.#frequencies ??= senderFrequencies(this.contacts);
		return this.#frequencies;
	}

	/** Stops the worker; the next call starts a fresh one. */
	dispose(): void {
		void this.#connection?.then((connection) => connection.terminate());
		this.#connection = undefined;
	}

	#worker(): Promise<AIWorkerConnection> {
		this.#connection ??= this.connect().catch((error: unknown) => {
			this.#connection = undefined;
			throw error;
		});
		return this.#connection;
	}
}

/** The text the spam model reads: the same subject + body pair it was trained on. */
export function spamText(message: Message): string {
	return `${message.subject}
${message.bodyText}`;
}

function categoryInput(message: Message) {
	return { fromEmail: message.from.email, subject: message.subject, bodyText: message.bodyText };
}

function spamInput(message: Message) {
	return {
		fromName: message.from.name ?? '',
		fromEmail: message.from.email,
		subject: message.subject,
		bodyText: message.bodyText,
		bodyHtml: message.bodyHtml
	};
}

export const [getAIService, setAIService] = createContext<AIService>();
