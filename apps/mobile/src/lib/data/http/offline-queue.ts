import { AppError, type EndpointName } from '@nem/shared';
import type { CallOptions, HttpClient, ResponseOf } from './client.js';
import type { TokenStorage } from './session-tokens.js';

/** Changes worth keeping when the server cannot be reached; reads and sends are never queued. */
export type QueueableEndpoint =
	| 'bulkThreads'
	| 'deleteThreads'
	| 'emptyMailbox'
	| 'saveDraft'
	| 'deleteDraft'
	| 'putSettings'
	| 'aiFeedback';

interface QueuedAction {
	/** The account that made the change; it is only replayed while that account is active. */
	userId: string;
	name: QueueableEndpoint;
	params?: Record<string, string>;
	body?: unknown;
}

const KEY = 'nem-mail:offline-queue';
/** Errors that mean the server was not reached, so the change is kept for later. */
const OFFLINE_CODES = new Set(['NETWORK', 'TIMEOUT']);

export interface OfflineQueueOptions {
	http: Pick<HttpClient, 'call'>;
	storage?: TokenStorage;
	/** The active account; nothing is queued without one. */
	userId: () => string | null;
	isOnline?: () => boolean;
}

/**
 * The offline action queue (PRD: "In Phase 2, actions taken offline are queued"). A change that
 * cannot reach the server is saved on the device and answered with what the server would have
 * said, so the optimistic UI stays; `flush` replays the queue in order once the server is back.
 * A replayed change the server rejects (say, a thread deleted meanwhile) is dropped.
 */
export class OfflineQueue {
	readonly #http: Pick<HttpClient, 'call'>;
	readonly #storage: TokenStorage | undefined;
	readonly #userId: () => string | null;
	readonly #isOnline: () => boolean;
	#actions: QueuedAction[];
	#flushing: Promise<number> | null = null;

	constructor({ http, storage, userId, isOnline = browserOnline }: OfflineQueueOptions) {
		this.#http = http;
		this.#storage = storage;
		this.#userId = userId;
		this.#isOnline = isOnline;
		this.#actions = this.#load();
	}

	/** Changes waiting for the server, for the active account. */
	get pending(): number {
		const userId = this.#userId();
		return this.#actions.filter((action) => action.userId === userId).length;
	}

	/**
	 * Sends the change, or queues it when offline (or when older changes are still queued, to keep
	 * the order) and resolves with `offline` instead.
	 */
	async call<N extends QueueableEndpoint>(
		name: N,
		options: Pick<CallOptions<N>, 'params' | 'body'>,
		offline: () => ResponseOf<N>
	): Promise<ResponseOf<N>>;
	async call(
		name: QueueableEndpoint,
		options: { params?: Record<string, string>; body?: unknown },
		offline: () => unknown
	): Promise<unknown> {
		const userId = this.#userId();
		if (userId && (this.pending > 0 || !this.#isOnline())) {
			this.#enqueue({ userId, name, ...options });
			void this.flush();
			return offline();
		}
		try {
			return await this.#send(name, options);
		} catch (error) {
			if (!userId || !isOffline(error)) throw error;
			this.#enqueue({ userId, name, ...options });
			return offline();
		}
	}

	/** Replays the active account's queue in order; stops at the first change that is still offline. Returns how many went through. */
	flush(): Promise<number> {
		this.#flushing ??= this.#replay().finally(() => (this.#flushing = null));
		return this.#flushing;
	}

	async #replay(): Promise<number> {
		let sent = 0;
		for (;;) {
			const userId = this.#userId();
			const next = this.#actions.find((action) => action.userId === userId);
			if (!next || !this.#isOnline()) return sent;
			try {
				await this.#send(next.name, next);
				sent++;
			} catch (error) {
				if (isOffline(error)) return sent;
				console.warn(`Dropped a queued ${next.name} the server refused`, error);
			}
			this.#actions = this.#actions.filter((action) => action !== next);
			this.#save();
		}
	}

	#send(name: QueueableEndpoint, { params, body }: Omit<QueuedAction, 'userId' | 'name'>) {
		return (this.#http.call as (name: EndpointName, options: object) => Promise<unknown>)(name, {
			params,
			body
		});
	}

	#enqueue(action: QueuedAction): void {
		this.#actions = [...this.#actions, action];
		this.#save();
	}

	#load(): QueuedAction[] {
		try {
			const parsed: unknown = JSON.parse(this.#storage?.getItem(KEY) ?? '[]');
			return Array.isArray(parsed) ? (parsed as QueuedAction[]) : [];
		} catch {
			return [];
		}
	}

	#save(): void {
		try {
			if (this.#actions.length === 0) this.#storage?.removeItem(KEY);
			else this.#storage?.setItem(KEY, JSON.stringify(this.#actions));
		} catch {
			// Private mode or full storage: the queue lasts until reload.
		}
	}
}

function isOffline(error: unknown): boolean {
	return error instanceof AppError && OFFLINE_CODES.has(error.code);
}

function browserOnline(): boolean {
	return globalThis.navigator?.onLine !== false;
}
