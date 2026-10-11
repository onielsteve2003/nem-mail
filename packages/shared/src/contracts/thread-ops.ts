import type { Thread, ThreadSummary } from '../schemas/mail';
import { STORED_MAILBOXES, type StoredMailbox, type SystemMailbox } from '../schemas/mailbox';
import type { ThreadListFilter, ThreadOp } from './threads';

/*
 * The rules behind ThreadOp and list filters. The mock backend, the Phase 2 API
 * and the optimistic updates in the stores all apply these, so they agree.
 */

/** The mailboxes a user moves threads between; a thread is in at most one of them. */
const MOVABLE = ['inbox', 'spam', 'trash'] as const satisfies readonly StoredMailbox[];
type Movable = (typeof MOVABLE)[number];

/** Threads in spam or trash show only there, never in other views. */
function isBinned(thread: ThreadSummary): boolean {
	return thread.mailboxes.includes('spam') || thread.mailboxes.includes('trash');
}

/** Snoozed threads stay filed in the inbox but hide until `snoozedUntil` passes. */
export function isSnoozed(thread: ThreadSummary, now: number): boolean {
	return thread.snoozedUntil !== null && Date.parse(thread.snoozedUntil) > now;
}

/** Whether a thread appears in a mailbox view (see STORED_MAILBOXES for which are views). */
export function inMailbox(thread: ThreadSummary, mailbox: SystemMailbox, now: number): boolean {
	switch (mailbox) {
		case 'spam':
		case 'trash':
			return thread.mailboxes.includes(mailbox);
		case 'inbox':
			return thread.mailboxes.includes('inbox') && !isBinned(thread) && !isSnoozed(thread, now);
		case 'starred':
			return thread.isStarred && !isBinned(thread);
		case 'important':
			return thread.isImportant && !isBinned(thread);
		case 'snoozed':
			return isSnoozed(thread, now) && !isBinned(thread);
		case 'all':
			return !isBinned(thread);
		default:
			return thread.mailboxes.includes(mailbox) && !isBinned(thread);
	}
}

/** Whether a thread belongs in a list filter: a mailbox (and tab) or a label. */
export function matchesFilter(
	thread: ThreadSummary,
	filter: ThreadListFilter,
	now: number
): boolean {
	if ('labelId' in filter) return thread.labelIds.includes(filter.labelId) && !isBinned(thread);
	if (!inMailbox(thread, filter.mailbox, now)) return false;
	return filter.category === undefined || thread.category === filter.category;
}

/** Newest first; the id breaks ties so the order (and the cursor) is stable. */
export function sortKey(thread: ThreadSummary): string {
	return `${thread.lastMessageAt}|${thread.id}`;
}

/** The list row for a thread: everything but the messages. */
export function toSummary(thread: Thread): ThreadSummary {
	const summary: Partial<Thread> = { ...thread };
	delete summary.messages;
	return summary as ThreadSummary;
}

/**
 * Returns the thread after one bulk op. Pure: the input is not changed.
 * Works on a full thread or a list summary (a summary has no messages to mark).
 */
export function applyThreadOp<T extends ThreadSummary>(thread: T, op: ThreadOp): T {
	const next: T = { ...thread };
	switch (op.op) {
		case 'markRead':
			return withRead(next, true);
		case 'markUnread':
			return withRead(next, false);
		case 'star':
		case 'unstar':
			return { ...next, isStarred: op.op === 'star' };
		case 'markImportant':
		case 'markNotImportant':
			return { ...next, isImportant: op.op === 'markImportant' };
		case 'archive':
			return { ...next, mailboxes: next.mailboxes.filter((m) => m !== 'inbox') };
		case 'trash':
			return moveTo(next, 'trash');
		case 'spam':
			return moveTo(next, 'spam');
		case 'notSpam':
			return moveTo(next, 'inbox');
		case 'move':
			return moveTo(next, op.to);
		case 'mute':
			// Muting also archives; later replies skip the inbox (FR-6.6).
			return { ...next, isMuted: true, mailboxes: next.mailboxes.filter((m) => m !== 'inbox') };
		case 'unmute':
			return { ...next, isMuted: false };
		case 'setCategory':
			return { ...next, category: op.category };
		case 'addLabels':
			return { ...next, labelIds: [...new Set([...next.labelIds, ...op.labelIds])] };
		case 'removeLabels':
			return { ...next, labelIds: next.labelIds.filter((id) => !op.labelIds.includes(id)) };
		case 'snooze':
			// It wakes up in the inbox, even if it was archived (FR-6.3).
			return { ...moveTo(next, 'inbox'), snoozedUntil: op.until };
		case 'unsnooze':
			return { ...next, snoozedUntil: null };
	}
}

function withRead<T extends ThreadSummary>(thread: T, isRead: boolean): T {
	const next = { ...thread, isUnread: !isRead };
	const messages = (thread as Partial<Thread>).messages;
	if (!messages) return next;
	const lastIndex = messages.length - 1;
	return {
		...next,
		// Marking unread flags only the latest message, as mail clients do.
		messages: messages.map((m, i) => (isRead || i === lastIndex ? { ...m, isRead } : m))
	};
}

function moveTo<T extends ThreadSummary>(thread: T, to: StoredMailbox): T {
	return addMailbox({ ...thread, mailboxes: thread.mailboxes.filter((m) => !isMovable(m)) }, to);
}

/** Adds a mailbox, keeping the canonical STORED_MAILBOXES order. */
function addMailbox<T extends ThreadSummary>(thread: T, mailbox: StoredMailbox): T {
	const set = new Set([...thread.mailboxes, mailbox]);
	return { ...thread, mailboxes: STORED_MAILBOXES.filter((m) => set.has(m)) };
}

/** Where a thread is filed among inbox, spam and trash; null when archived. */
function isMovable(mailbox: StoredMailbox): mailbox is Movable {
	return (MOVABLE as readonly StoredMailbox[]).includes(mailbox);
}

function location(thread: ThreadSummary): Movable | null {
	return MOVABLE.find((m) => thread.mailboxes.includes(m)) ?? null;
}

/**
 * The ops that take a thread from `after` back to `before`, for Undo. Exact
 * where the ops allow it; empty when nothing changed.
 */
export function restoreOps(before: ThreadSummary, after: ThreadSummary): ThreadOp[] {
	const ops: ThreadOp[] = [];
	if (before.snoozedUntil !== after.snoozedUntil) {
		ops.push(
			before.snoozedUntil === null
				? { op: 'unsnooze' }
				: { op: 'snooze', until: before.snoozedUntil }
		);
	}
	// Mute archives, so it goes before restoring the location.
	if (before.isMuted !== after.isMuted) ops.push({ op: before.isMuted ? 'mute' : 'unmute' });
	const from = location(before);
	if (from !== location(applyAll(after, ops))) {
		// There is no "move to archive" op: archived means filed nowhere, so file it in the inbox first.
		if (from) ops.push({ op: 'move', to: from });
		else ops.push({ op: 'move', to: 'inbox' }, { op: 'archive' });
	}
	if (before.isUnread !== after.isUnread) {
		ops.push({ op: before.isUnread ? 'markUnread' : 'markRead' });
	}
	if (before.isStarred !== after.isStarred) ops.push({ op: before.isStarred ? 'star' : 'unstar' });
	if (before.isImportant !== after.isImportant) {
		ops.push({ op: before.isImportant ? 'markImportant' : 'markNotImportant' });
	}
	if (before.category !== null && before.category !== after.category) {
		ops.push({ op: 'setCategory', category: before.category });
	}
	const added = after.labelIds.filter((id) => !before.labelIds.includes(id));
	const removed = before.labelIds.filter((id) => !after.labelIds.includes(id));
	if (added.length > 0) ops.push({ op: 'removeLabels', labelIds: added });
	if (removed.length > 0) ops.push({ op: 'addLabels', labelIds: removed });
	return ops;
}

function applyAll<T extends ThreadSummary>(thread: T, ops: ThreadOp[]): T {
	return ops.reduce((next, op) => applyThreadOp(next, op), thread);
}
