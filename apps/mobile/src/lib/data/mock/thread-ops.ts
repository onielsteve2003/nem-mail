import {
	STORED_MAILBOXES,
	type StoredMailbox,
	type SystemMailbox,
	type Thread,
	type ThreadListFilter,
	type ThreadOp,
	type ThreadSummary
} from '@nem/shared';

/** The mailboxes a user moves threads between; a thread is in at most one of them. */
const MOVABLE: readonly StoredMailbox[] = ['inbox', 'spam', 'trash'];

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

/** Returns the thread after one bulk op. Pure: the input is not changed. */
export function applyThreadOp(thread: Thread, op: ThreadOp): Thread {
	const next: Thread = { ...thread };
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

function withRead(thread: Thread, isRead: boolean): Thread {
	const lastIndex = thread.messages.length - 1;
	return {
		...thread,
		isUnread: !isRead,
		// Marking unread flags only the latest message, as mail clients do.
		messages: thread.messages.map((m, i) => (isRead || i === lastIndex ? { ...m, isRead } : m))
	};
}

function moveTo(thread: Thread, to: StoredMailbox): Thread {
	return addMailbox(
		{ ...thread, mailboxes: thread.mailboxes.filter((m) => !MOVABLE.includes(m)) },
		to
	);
}

/** Adds a mailbox, keeping the canonical STORED_MAILBOXES order. */
function addMailbox(thread: Thread, mailbox: StoredMailbox): Thread {
	const set = new Set([...thread.mailboxes, mailbox]);
	return { ...thread, mailboxes: STORED_MAILBOXES.filter((m) => set.has(m)) };
}
