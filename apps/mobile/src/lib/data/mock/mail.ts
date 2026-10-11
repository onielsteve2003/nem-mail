import {
	AppError,
	SYSTEM_MAILBOXES,
	applyThreadOp,
	inMailbox,
	matchesFilter,
	sortKey,
	toSummary,
	type BulkThreadResponse,
	type CountsResponse,
	type Page,
	type PageQuery,
	type ServerEvent,
	type Thread,
	type ThreadListFilter,
	type ThreadOp,
	type ThreadSummary
} from '@nem/shared';
import type { MailRepository } from '../repositories.js';
import type { MockContext } from './context.js';
import { stripOwner, type MockDb, type Owned } from './db.js';
import { paginate } from './paginate.js';

/** Mailboxes whose badge counts every item, not just unread ones. */
const COUNT_ALL = new Set(['drafts', 'outbox', 'scheduled']);

/** Mail backed by IndexedDB, with the same contract the HTTP repository will follow. */
export class MockMailRepository implements MailRepository {
	readonly #ctx: MockContext;

	constructor(ctx: MockContext) {
		this.#ctx = ctx;
	}

	/** One page of a mailbox, inbox tab or label, newest first. */
	list(filter: ThreadListFilter, page: PageQuery = {}): Promise<Page<ThreadSummary>> {
		return this.#ctx.authed(async (db, userId) => {
			const now = this.#ctx.now();
			const rows = (await ownThreads(db, userId))
				.map((thread) => toSummary(stripOwner(thread)))
				.filter((thread) => matchesFilter(thread, filter, now))
				.sort((a, b) => (sortKey(a) < sortKey(b) ? 1 : -1));
			return paginate(rows, page, sortKey);
		});
	}

	/** A thread with its messages. @throws AppError NOT_FOUND for another account's thread too. */
	get(threadId: string): Promise<Thread> {
		return this.#ctx.authed(async (db, userId) =>
			stripOwner(await ownThread(db, userId, threadId))
		);
	}

	apply(threadIds: string[], op: ThreadOp): Promise<BulkThreadResponse> {
		return this.#ctx.authed(async (db, userId) => {
			const tx = db.transaction('threads', 'readwrite');
			const updatedIds: string[] = [];
			for (const id of new Set(threadIds)) {
				const stored = await tx.store.get(id);
				if (!stored || stored.ownerId !== userId) continue;
				const next = { ...applyThreadOp(stored, op), ownerId: userId };
				if (JSON.stringify(next) === JSON.stringify(stored)) continue;
				await tx.store.put(next);
				updatedIds.push(id);
			}
			await tx.done;
			if (updatedIds.length > 0) {
				this.#ctx.emit({ type: 'counts', counts: await countsFor(db, userId, this.#ctx.now()) });
			}
			return { updatedIds };
		});
	}

	counts(): Promise<CountsResponse> {
		return this.#ctx.authed((db, userId) => countsFor(db, userId, this.#ctx.now()));
	}

	/** The attachment's bytes; seed attachments get a small placeholder file. */
	getAttachment(attachmentId: string): Promise<Blob> {
		return this.#ctx.authed(async (db, userId) => {
			const blob = await db.get('blobs', attachmentId);
			if (blob) return blob;
			for (const thread of await ownThreads(db, userId)) {
				for (const message of thread.messages) {
					const found = message.attachments.find((a) => a.id === attachmentId);
					if (found) {
						return new Blob([`Nem Mail demo attachment: ${found.filename}`], {
							type: found.mime
						});
					}
				}
			}
			throw new AppError('NOT_FOUND', 'Attachment not found');
		});
	}

	subscribe(listener: (event: ServerEvent) => void): () => void {
		return this.#ctx.subscribe(listener);
	}
}

/** Badge counts for one account at `now`. */
export async function countsFor(db: MockDb, userId: string, now: number): Promise<CountsResponse> {
	const threads = (await ownThreads(db, userId)).map(toSummary);
	const counts: CountsResponse = { mailboxes: {}, categories: {}, labels: {} };
	for (const mailbox of SYSTEM_MAILBOXES) {
		const all = COUNT_ALL.has(mailbox);
		counts.mailboxes[mailbox] = threads.filter(
			(t) => (all || t.isUnread) && inMailbox(t, mailbox, now)
		).length;
	}
	counts.mailboxes.drafts = await db.countFromIndex('drafts', 'byOwner', userId);
	for (const thread of threads) {
		if (!thread.isUnread) continue;
		if (thread.category && inMailbox(thread, 'inbox', now)) {
			counts.categories[thread.category] = (counts.categories[thread.category] ?? 0) + 1;
		}
		if (!inMailbox(thread, 'all', now)) continue;
		for (const labelId of thread.labelIds) {
			counts.labels[labelId] = (counts.labels[labelId] ?? 0) + 1;
		}
	}
	return counts;
}

function ownThreads(db: MockDb, userId: string): Promise<Owned<Thread>[]> {
	return db.getAllFromIndex('threads', 'byOwner', userId);
}

/** @throws AppError NOT_FOUND when missing or owned by another account. */
export async function ownThread(
	db: MockDb,
	userId: string,
	threadId: string
): Promise<Owned<Thread>> {
	const thread = await db.get('threads', threadId);
	if (!thread || thread.ownerId !== userId) throw new AppError('NOT_FOUND', 'Thread not found');
	return thread;
}
