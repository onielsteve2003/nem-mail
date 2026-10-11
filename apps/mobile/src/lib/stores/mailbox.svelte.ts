import {
	applyThreadOp,
	matchesFilter,
	restoreOps,
	sortKey,
	type AppError,
	type CountsResponse,
	type Cursor,
	type ThreadListFilter,
	type ThreadOp,
	type ThreadOpName,
	type ThreadSummary
} from '@nem/shared';
import { createContext } from 'svelte';
import type { MailRepository } from '#lib/data/repositories.js';
import { errorMessage, toAppError } from '#lib/utils/errors.js';
import type { ThreadStore } from './thread.svelte.js';
import { toastStore, type ToastStore } from './toast.svelte.js';

/** One cached list: a mailbox, an inbox tab or a label. */
export interface ThreadList {
	filter: ThreadListFilter;
	items: ThreadSummary[];
	nextCursor: Cursor | null;
	/** `loading` only before the first page; later fetches use the flags below. */
	status: 'loading' | 'ready' | 'error';
	isRefreshing: boolean;
	isLoadingMore: boolean;
	/** A mutation may have changed what belongs here; the next load fetches again. */
	isStale: boolean;
	error: AppError | null;
}

/** Cache key for a list filter. */
export function listKey(filter: ThreadListFilter): string {
	return 'labelId' in filter
		? `label:${filter.labelId}`
		: `mailbox:${filter.mailbox}:${filter.category ?? ''}`;
}

const RETRY = 'Retry';
const UNDO = 'Undo';
const LOAD_FAILED = "Couldn't load your mail.";
const UPDATE_FAILED = "Couldn't update.";

/** Toast copy for ops worth confirming; quiet ops (read, star…) get none. */
const OP_TOAST: Partial<Record<ThreadOpName, string>> = {
	archive: 'Archived',
	trash: 'Moved to Trash',
	spam: 'Reported as spam',
	notSpam: 'Moved to Inbox',
	move: 'Moved',
	mute: 'Muted',
	snooze: 'Snoozed',
	setCategory: 'Moved to tab',
	addLabels: 'Labels added',
	removeLabels: 'Labels removed'
};

function toastCopy(op: ThreadOpName, count: number): string | null {
	const copy = OP_TOAST[op];
	if (!copy) return null;
	return count === 1 ? copy : `${copy}: ${count} conversations`;
}

export interface MailboxStoreOptions {
	mail: MailRepository;
	/** Cached open threads, kept in step with list mutations. */
	threads?: ThreadStore;
	toasts?: ToastStore;
	now?: () => number;
}

/**
 * Thread lists cached per filter, with cursor pagination and optimistic
 * mutations: the change shows at once, rolls back if the server refuses,
 * and Undo restores the previous state (architecture §5).
 */
export class MailboxStore {
	lists = $state<Record<string, ThreadList>>({});
	counts = $state<CountsResponse | null>(null);

	readonly #mail: MailRepository;
	readonly #threads: ThreadStore | undefined;
	readonly #toasts: ToastStore;
	readonly #now: () => number;
	/** Bumped by reset(), so responses that started before it are dropped. */
	#generation = 0;

	constructor({ mail, threads, toasts = toastStore, now = Date.now }: MailboxStoreOptions) {
		this.#mail = mail;
		this.#threads = threads;
		this.#toasts = toasts;
		this.#now = now;
	}

	list(filter: ThreadListFilter): ThreadList | undefined {
		return this.lists[listKey(filter)];
	}

	/**
	 * Loads the first page. A cached, fresh list is left alone unless `refresh`
	 * is set (pull to refresh); a stale one is fetched while it keeps showing.
	 */
	async load(filter: ThreadListFilter, { refresh = false } = {}): Promise<void> {
		const key = listKey(filter);
		const cached = this.lists[key];
		if (cached) {
			if (cached.status === 'loading' || cached.isRefreshing) return;
			if (cached.status === 'ready' && !cached.isStale && !refresh) return;
		}
		const hasItems = (cached?.items.length ?? 0) > 0;
		if (cached && hasItems) {
			cached.isRefreshing = true;
		} else {
			this.lists[key] = {
				filter,
				items: [],
				nextCursor: null,
				status: 'loading',
				isRefreshing: false,
				isLoadingMore: false,
				isStale: false,
				error: null
			};
		}
		const generation = this.#generation;
		try {
			const page = await this.#mail.list(filter);
			const list = this.#current(key, generation);
			if (!list) return;
			list.items = page.items;
			list.nextCursor = page.nextCursor;
			list.status = 'ready';
			list.isStale = false;
			list.error = null;
		} catch (error) {
			const list = this.#current(key, generation);
			if (!list) return;
			list.error = toAppError(error);
			if (hasItems) {
				this.#toastError(LOAD_FAILED, list.error, () => void this.load(filter, { refresh: true }));
			} else {
				list.status = 'error';
			}
		} finally {
			const list = this.#current(key, generation);
			if (list) list.isRefreshing = false;
		}
	}

	/** Appends the next page (infinite scroll). Does nothing on the last page. */
	async loadMore(filter: ThreadListFilter): Promise<void> {
		const key = listKey(filter);
		const cached = this.lists[key];
		if (!cached || cached.status !== 'ready' || cached.isLoadingMore || !cached.nextCursor) return;
		cached.isLoadingMore = true;
		const generation = this.#generation;
		try {
			const page = await this.#mail.list(filter, { cursor: cached.nextCursor });
			const list = this.#current(key, generation);
			if (!list) return;
			const seen = list.items.map((thread) => thread.id);
			list.items = [...list.items, ...page.items.filter((thread) => !seen.includes(thread.id))];
			list.nextCursor = page.nextCursor;
		} catch (error) {
			const list = this.#current(key, generation);
			if (!list) return;
			list.error = toAppError(error);
			this.#toastError(LOAD_FAILED, list.error, () => void this.loadMore(filter));
		} finally {
			const list = this.#current(key, generation);
			if (list) list.isLoadingMore = false;
		}
	}

	/**
	 * Applies an op at once to every cached list and open thread, then saves
	 * it. On failure everything rolls back and an error toast offers Retry.
	 * Ops with toast copy offer Undo. Resolves true when saved.
	 */
	async apply(
		threadIds: string[],
		op: ThreadOp,
		{ undoable = true }: { undoable?: boolean } = {}
	): Promise<boolean> {
		const ids = threadIds.filter((id, index) => threadIds.indexOf(id) === index);
		if (ids.length === 0) return true;
		const before = this.#summaries(ids);
		const lists = $state.snapshot(this.lists) as Record<string, ThreadList>;
		const threads = this.#threads?.snapshot();
		this.#applyLocal(ids, op);
		const generation = this.#generation;
		try {
			await this.#mail.apply(ids, op);
		} catch (error) {
			if (generation !== this.#generation) return false;
			this.lists = lists;
			if (threads) this.#threads?.restore(threads);
			this.#toastError(UPDATE_FAILED, error, () => void this.apply(ids, op, { undoable }));
			return false;
		}
		// Rows may now belong in lists that were not touched (e.g. starred).
		for (const list of Object.values(this.lists)) list.isStale = true;
		const copy = toastCopy(op.op, ids.length);
		if (undoable && copy) {
			this.#toasts.show({
				message: copy,
				action: { label: UNDO, onaction: () => void this.#undo(before, op) }
			});
		}
		return true;
	}

	/** Puts a new or updated thread into every cached list it belongs to, newest first. */
	ingest(summary: ThreadSummary): void {
		const now = this.#now();
		for (const list of Object.values(this.lists)) {
			const rest = list.items.filter((thread) => thread.id !== summary.id);
			const key = sortKey(summary);
			const index = rest.findIndex((thread) => sortKey(thread) < key);
			// Past the loaded pages it is left out: a later page brings it.
			const fits = matchesFilter(summary, list.filter, now) && (index !== -1 || !list.nextCursor);
			if (fits) rest.splice(index === -1 ? rest.length : index, 0, summary);
			if (fits || rest.length !== list.items.length) list.items = rest;
		}
	}

	async refreshCounts(): Promise<void> {
		this.counts = await this.#mail.counts();
	}

	/** Follows server events: new mail and count changes. Returns an unsubscribe function. */
	connect(): () => void {
		return this.#mail.subscribe((event) => {
			if (event.type === 'mail.new') this.ingest(event.summary);
			else this.counts = event.counts;
		});
	}

	/** Forgets every list, e.g. after switching accounts. */
	reset(): void {
		this.#generation++;
		this.lists = {};
		this.counts = null;
	}

	#applyLocal(ids: string[], op: ThreadOp): void {
		const now = this.#now();
		for (const list of Object.values(this.lists)) {
			list.items = list.items
				.map((thread) => (ids.includes(thread.id) ? applyThreadOp(thread, op) : thread))
				.filter((thread) => !ids.includes(thread.id) || matchesFilter(thread, list.filter, now));
		}
		this.#threads?.applyLocal(ids, op);
	}

	/**
	 * Undo: works out which ops take each thread back from `op`, groups threads
	 * that need the same ops, and applies each group.
	 */
	async #undo(before: ThreadSummary[], op: ThreadOp): Promise<void> {
		const groups: Record<string, { ops: ThreadOp[]; ids: string[] }> = {};
		for (const thread of before) {
			const ops = restoreOps(thread, applyThreadOp(thread, op));
			if (ops.length === 0) continue;
			const key = JSON.stringify(ops);
			const group = (groups[key] ??= { ops, ids: [] });
			group.ids.push(thread.id);
		}
		for (const { ops, ids } of Object.values(groups)) {
			for (const restore of ops) {
				if (!(await this.apply(ids, restore, { undoable: false }))) return;
			}
		}
	}

	/** The current copy of each thread, from the open threads or the cached lists. */
	#summaries(ids: string[]): ThreadSummary[] {
		const items = Object.values(this.lists).flatMap((list) => list.items);
		return ids.flatMap((id) => {
			const thread = this.#threads?.get(id)?.thread ?? items.find((item) => item.id === id);
			return thread ? [$state.snapshot(thread) as ThreadSummary] : [];
		});
	}

	#current(key: string, generation: number): ThreadList | undefined {
		return generation === this.#generation ? this.lists[key] : undefined;
	}

	#toastError(message: string, error: unknown, retry: () => void): void {
		const appError = toAppError(error);
		this.#toasts.show({
			message: `${message} ${errorMessage(appError)}`,
			tone: 'error',
			action: appError.retryable ? { label: RETRY, onaction: retry } : undefined
		});
	}
}

export const [getMailboxStore, setMailboxStore] = createContext<MailboxStore>();
