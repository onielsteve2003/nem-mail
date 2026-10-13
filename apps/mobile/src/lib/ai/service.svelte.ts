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
import type {
	ContactRepository,
	MailRepository,
	SettingsRepository
} from '#lib/data/repositories.js';
import type { AIBackend } from './backend.js';
import type { CategoryVerdict } from './models/category.js';
import { hybridRank } from './models/hybrid.js';
import type { ExtractionVerdict } from './models/extract.js';
import type { ComposeVerdict } from './models/ngram.js';
import {
	FOLLOW_UP_DAYS,
	FOLLOW_UP_MAX_DAYS,
	followUpNudge,
	unsubscribeSuggestions,
	type FollowUpVerdict,
	type UnsubscribeVerdict
} from './models/nudges.js';
import type { PrioritySignal, PriorityVerdict } from './models/priority-lr.js';
import type { SmartReplyVerdict } from './models/smart-reply.js';
import type { SpamVerdict } from './models/spam-nb.js';
import type { SummaryVerdict } from './models/textrank.js';
import type { ToneVerdict } from './models/tone.js';
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
/** How many sent conversations smart compose first learns from. */
const SENT_SAMPLE = 25;
/** Semantic search looks at up to this many conversations (pages of 100). */
const CORPUS_PAGES = 5;
/** The thread list for semantic search is reused this long, so new mail joins soon. */
const CORPUS_TTL_MS = 60_000;
/** Sent conversations checked for follow-up nudges. */
const SENT_NUDGE_PAGE = 50;
const DAY_MS = 86_400_000;
const DOWNLOAD_FAILED = 'Download failed. Check your connection and try again.';

/** Inbox rows from the assistant (AI-9, AI-12); a feature that is off gives none. */
export interface InboxNudges {
	followUps: FollowUpVerdict[];
	unsubscribe: UnsubscribeVerdict[];
}

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
	/** Smart replies by the id of the message they answer (AI-4). */
	replies = $state<Record<string, SmartReplyVerdict | null>>({});
	/** Smart extraction by message id (AI-10); null when a message has nothing to act on. */
	extractions = $state<Record<string, ExtractionVerdict | null>>({});
	/** Priority scores by thread id (AI-6). */
	priority = $state<Record<string, PriorityVerdict>>({});

	#connection: Promise<AIWorkerConnection> | undefined;
	#frequencies: Promise<ReadonlyMap<string, number>> | undefined;
	#composeTrained: { userId: string; done: Promise<void> } | undefined;
	#corpus: { userId: string; at: number; threads: Promise<ThreadSummary[]> } | undefined;

	constructor(
		private readonly settings: SettingsRepository | null = null,
		private readonly connect: ConnectWorker = connectDefault,
		private readonly contacts: ContactRepository | null = null,
		private readonly mail: MailRepository | null = null
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
	 * Three short replies to a message (AI-4). Null when the user turned smart replies
	 * off, the message is the user's own, or nobody replies to it (no-reply, bulk).
	 */
	async smartReplies(message: Message, selfEmail: string): Promise<SmartReplyVerdict | null> {
		if (!this.isEnabled('smartReply')) return null;
		if (message.from.email.toLowerCase() === selfEmail.toLowerCase()) return null;
		if (message.id in this.replies) return this.replies[message.id] ?? null;
		const { api } = await this.#worker();
		const verdict = await api.smartReplies({
			fromName: message.from.name ?? '',
			fromEmail: message.from.email,
			subject: message.subject,
			text: message.bodyText
		});
		this.replies[message.id] = verdict;
		return verdict;
	}

	/**
	 * Codes, tracking numbers, dates, and meeting times in a message, for action chips
	 * (AI-10). Null when smart extraction is off or the message has none.
	 */
	async extract(message: Message): Promise<ExtractionVerdict | null> {
		if (!this.isEnabled('extraction')) return null;
		if (message.id in this.extractions) return this.extractions[message.id] ?? null;
		const { api } = await this.#worker();
		const verdict = await api.extract({
			subject: message.subject,
			text: message.bodyText,
			sentAt: message.sentAt
		});
		this.extractions[message.id] = verdict;
		return verdict;
	}

	/**
	 * Ghost text for the paragraph before the caret (AI-5). The first call for an account
	 * with no saved model trains it on recent sent mail. Null when smart compose is off
	 * or no continuation is likely enough.
	 */
	async complete(user: AIUser, before: string): Promise<ComposeVerdict | null> {
		if (!this.isEnabled('smartCompose')) return null;
		await this.#trainCompose(user);
		const { api } = await this.#worker();
		return api.complete(user.id, before);
	}

	/** Teaches smart compose from a message the user sent. */
	async learnCompose(userId: string, text: string): Promise<void> {
		if (!this.isEnabled('smartCompose') || !text.trim()) return;
		const { api } = await this.#worker();
		await api.learnCompose(userId, [text]);
	}

	/**
	 * Checks how a message the user is about to send may land (AI-8). Null when the tone
	 * check is off or the message is empty.
	 */
	async checkTone(text: string): Promise<ToneVerdict | null> {
		if (!this.isEnabled('toneCheck') || !text.trim()) return null;
		const { api } = await this.#worker();
		return api.checkTone(text);
	}

	/**
	 * Semantic search (AI-7): ranks conversations by meaning with MiniLM, blended with the
	 * keyword hits in their order. With `allowNew`, conversations that share no word with
	 * the query can come in on meaning alone (only for plain text queries, since operator
	 * filters were applied to the keyword hits only). Null when the feature is off or
	 * the model is not downloaded, so the caller keeps the keyword results.
	 */
	async semanticSearch(
		userId: string,
		text: string,
		keywordHits: readonly ThreadSummary[],
		allowNew: boolean
	): Promise<ThreadSummary[] | null> {
		if (!this.isEnabled('semanticSearch') || !text.trim()) return null;
		const corpus = allowNew ? await this.#threadsFor(userId) : [];
		const byId: Record<string, ThreadSummary> = Object.fromEntries(
			[...corpus, ...keywordHits].map((thread) => [thread.id, thread])
		);
		const docs = Object.values(byId).map((thread) => ({
			id: thread.id,
			text: `${thread.subject}. ${thread.snippet}`
		}));
		const { api } = await this.#worker();
		const scores = await api.semanticScores(userId, text, docs);
		if (!scores) return null;
		return hybridRank(
			keywordHits.map((thread) => thread.id),
			scores,
			allowNew
		).flatMap((id) => byId[id] ?? []);
	}

	/**
	 * Follow-up nudges for the user's unanswered questions and unsubscribe suggestions
	 * for newsletters they rarely open, newest nudge first. Plain rules over a few dozen
	 * threads, so they run here rather than in the worker. Throws when mail fails to load.
	 */
	async inboxNudges(user: AIUser, now = Date.now()): Promise<InboxNudges> {
		const [followUps, unsubscribe] = await Promise.all([
			this.isEnabled('followUp') ? this.#followUps(user, now) : [],
			this.isEnabled('unsubscribe')
				? this.#threadsFor(user.id).then((threads) =>
						unsubscribeSuggestions(threads, user.email, now)
					)
				: []
		]);
		return { followUps, unsubscribe };
	}

	async #followUps(user: AIUser, now: number): Promise<FollowUpVerdict[]> {
		const mail = this.mail;
		if (!mail) return [];
		const page = await mail.list({ mailbox: 'sent' }, { limit: SENT_NUDGE_PAGE });
		const due = page.items.filter((thread) => {
			const age = now - Date.parse(thread.lastMessageAt);
			return age >= FOLLOW_UP_DAYS * DAY_MS && age <= (FOLLOW_UP_MAX_DAYS + 1) * DAY_MS;
		});
		const threads = await Promise.all(due.map((thread) => mail.get(thread.id)));
		return threads.flatMap((thread) => followUpNudge(thread, user.email, now) ?? []);
	}

	#threadsFor(userId: string): Promise<ThreadSummary[]> {
		const now = Date.now();
		if (this.#corpus?.userId !== userId || now - this.#corpus.at > CORPUS_TTL_MS) {
			const threads = listAll(this.mail);
			threads.catch(() => (this.#corpus = undefined));
			this.#corpus = { userId, at: now, threads };
		}
		return this.#corpus.threads;
	}

	#trainCompose(user: AIUser): Promise<void> {
		if (this.#composeTrained?.userId !== user.id) {
			const done = (async () => {
				const { api } = await this.#worker();
				if (await api.hasComposeModel(user.id)) return;
				await api.learnCompose(user.id, await sentTexts(this.mail, user.email));
			})().catch(() => {
				// Suggestions still come from the seed corpus; the next session tries again.
			});
			this.#composeTrained = { userId: user.id, done };
		}
		return this.#composeTrained.done;
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
		this.replies = {};
		this.extractions = {};
		this.#frequencies = undefined;
		this.#composeTrained = undefined;
		this.#corpus = undefined;
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

/** The latest conversations in All Mail (Spam and Trash left out), for semantic search. */
async function listAll(mail: MailRepository | null): Promise<ThreadSummary[]> {
	if (!mail) return [];
	const threads: ThreadSummary[] = [];
	let cursor: string | undefined;
	for (let page = 0; page < CORPUS_PAGES; page++) {
		const result = await mail.list({ mailbox: 'all' }, { limit: 100, cursor });
		threads.push(...result.items);
		if (!result.nextCursor) break;
		cursor = result.nextCursor;
	}
	return threads;
}

/** Body text of the user's own messages in their latest sent conversations. */
async function sentTexts(mail: MailRepository | null, selfEmail: string): Promise<string[]> {
	if (!mail) return [];
	const self = selfEmail.toLowerCase();
	const page = await mail.list({ mailbox: 'sent' }, { limit: SENT_SAMPLE });
	const threads = await Promise.all(page.items.map((thread) => mail.get(thread.id)));
	return threads.flatMap((thread) =>
		thread.messages
			.filter((message) => message.from.email.toLowerCase() === self)
			.map((message) => message.bodyText)
	);
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
