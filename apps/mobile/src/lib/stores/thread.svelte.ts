import { applyThreadOp, type AppError, type Thread, type ThreadOp } from '@nem/shared';
import { createContext } from 'svelte';
import type { MailRepository } from '#lib/data/repositories.js';
import { toAppError } from '#lib/utils/errors.js';

export interface ThreadEntry {
	status: 'loading' | 'ready' | 'error';
	thread: Thread | null;
	error: AppError | null;
}

/** Opened threads with their messages, cached by id for quick back-and-forth. */
export class ThreadStore {
	entries = $state<Record<string, ThreadEntry>>({});

	readonly #mail: MailRepository;
	/** Bumped by reset(), so a fetch that started before it is dropped. */
	#generation = 0;

	constructor(mail: MailRepository) {
		this.#mail = mail;
	}

	get(threadId: string): ThreadEntry | undefined {
		return this.entries[threadId];
	}

	/** Fetches a thread unless it is cached; `refresh` fetches again but keeps showing the old one. */
	async load(threadId: string, { refresh = false } = {}): Promise<void> {
		const cached = this.entries[threadId];
		if (cached?.status === 'loading' || (cached?.status === 'ready' && !refresh)) return;
		this.entries[threadId] = { status: 'loading', thread: cached?.thread ?? null, error: null };
		const generation = this.#generation;
		try {
			const thread = await this.#mail.get(threadId);
			if (generation === this.#generation) {
				this.entries[threadId] = { status: 'ready', thread, error: null };
			}
		} catch (error) {
			if (generation !== this.#generation) return;
			this.entries[threadId] = {
				status: cached?.thread ? 'ready' : 'error',
				thread: cached?.thread ?? null,
				error: toAppError(error)
			};
		}
	}

	/** Mirrors an optimistic op from the mailbox store onto cached threads. */
	applyLocal(threadIds: Iterable<string>, op: ThreadOp): void {
		for (const id of threadIds) {
			const entry = this.entries[id];
			if (entry?.thread) entry.thread = applyThreadOp(entry.thread, op);
		}
	}

	/** Plain copies of the cached threads, for rollback and Undo. */
	snapshot(): Record<string, ThreadEntry> {
		return $state.snapshot(this.entries) as Record<string, ThreadEntry>;
	}

	restore(snapshot: Record<string, ThreadEntry>): void {
		this.entries = snapshot;
	}

	/** Forgets everything, e.g. after switching accounts. */
	reset(): void {
		this.#generation++;
		this.entries = {};
	}
}

export const [getThreadStore, setThreadStore] = createContext<ThreadStore>();
