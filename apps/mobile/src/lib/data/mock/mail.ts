import {
	AppError,
	SYSTEM_MAILBOXES,
	applyThreadOp,
	isBinned,
	inMailbox,
	matchesFilter,
	sortKey,
	toSummary,
	type Attachment,
	type BinMailbox,
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

	deleteForever(threadIds: string[]): Promise<BulkThreadResponse> {
		return this.#remove((thread) => threadIds.includes(thread.id) && isBinned(thread));
	}

	empty(mailbox: BinMailbox): Promise<BulkThreadResponse> {
		return this.#remove((thread) => thread.mailboxes.includes(mailbox));
	}

	counts(): Promise<CountsResponse> {
		return this.#ctx.authed((db, userId) => countsFor(db, userId, this.#ctx.now()));
	}

	/** The attachment's bytes; seed attachments get a small placeholder file or picture. */
	getAttachment(attachmentId: string): Promise<Blob> {
		return this.#ctx.authed(async (db, userId) => {
			const stored = await db.get('blobs', attachmentId);
			if (stored instanceof Blob) return stored;
			if (stored) return new Blob([stored.bytes], { type: stored.type });
			for (const thread of await ownThreads(db, userId)) {
				for (const message of thread.messages) {
					const found = message.attachments.find((a) => a.id === attachmentId);
					if (found) return placeholderFile(found);
				}
			}
			throw new AppError('NOT_FOUND', 'Attachment not found');
		});
	}

	subscribe(listener: (event: ServerEvent) => void): () => void {
		return this.#ctx.subscribe(listener);
	}

	/** Deletes the account's threads that pass `test`, then reports new counts. */
	#remove(test: (thread: Thread) => boolean): Promise<BulkThreadResponse> {
		return this.#ctx.authed(async (db, userId) => {
			const tx = db.transaction('threads', 'readwrite');
			const updatedIds: string[] = [];
			for (const thread of await tx.store.index('byOwner').getAll(userId)) {
				if (!test(thread)) continue;
				await tx.store.delete(thread.id);
				updatedIds.push(thread.id);
			}
			await tx.done;
			if (updatedIds.length > 0) {
				this.#ctx.emit({ type: 'counts', counts: await countsFor(db, userId, this.#ctx.now()) });
			}
			return { updatedIds };
		});
	}
}

/**
 * Wakes snoozed threads whose time has come (FR-6.3): the snooze is cleared and
 * the thread is unread again. Runs on every simulator tick, so threads that came
 * due while the app was closed wake on the first tick after a reload. Returns
 * the threads that are back in the inbox (a thread trashed meanwhile wakes quietly).
 */
export async function wakeDue(db: MockDb, userId: string, now: number): Promise<ThreadSummary[]> {
	const tx = db.transaction('threads', 'readwrite');
	const woke: ThreadSummary[] = [];
	for (const thread of await tx.store.index('byOwner').getAll(userId)) {
		if (thread.snoozedUntil === null || Date.parse(thread.snoozedUntil) > now) continue;
		const awake = applyThreadOp(thread, { op: 'unsnooze' });
		const isBack = inMailbox(awake, 'inbox', now);
		const next = isBack ? applyThreadOp(awake, { op: 'markUnread' }) : awake;
		await tx.store.put(next);
		if (isBack) woke.push(toSummary(stripOwner(next)));
	}
	await tx.done;
	return woke;
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

/** Seed attachments have no bytes. Images get a drawn picture so thumbnails and previews show something. */
function placeholderFile(attachment: Attachment): Blob {
	if (!attachment.mime.startsWith('image/')) {
		return new Blob([`Nem Mail demo attachment: ${attachment.filename}`], {
			type: attachment.mime
		});
	}
	// The hue follows the id, so each picture looks different but stays the same across loads.
	const hue = [...attachment.id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 360;
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="hsl(${hue} 70% 55%)"/><stop offset="1" stop-color="hsl(${(hue + 60) % 360} 70% 30%)"/>
</linearGradient></defs>
<rect width="800" height="600" fill="url(#g)"/>
<circle cx="600" cy="170" r="70" fill="hsl(${hue} 90% 85%)" opacity="0.8"/>
<path d="M0 600 L260 300 L420 460 L560 340 L800 600 Z" fill="hsl(${hue} 40% 18%)" opacity="0.7"/>
</svg>`;
	return new Blob([svg], { type: 'image/svg+xml' });
}
