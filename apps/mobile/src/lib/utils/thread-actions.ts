import type { ThreadOp, ThreadSummary } from '@nem/shared';

/** Where the bulk "Move to" sheet can send threads (the `move` op's targets). */
export const MOVE_TARGETS = [
	{ to: 'inbox', label: 'Inbox' },
	{ to: 'spam', label: 'Spam' },
	{ to: 'trash', label: 'Trash' }
] as const;

/**
 * The toggle ops for a selection. Each flips the way most mail clients do:
 * if any thread still needs it the op applies, otherwise it undoes.
 */
export function bulkToggles(threads: readonly ThreadSummary[]) {
	const some = (test: (thread: ThreadSummary) => boolean) => threads.some(test);
	return {
		read: { op: some((t) => t.isUnread) ? 'markRead' : 'markUnread' },
		star: { op: some((t) => !t.isStarred) ? 'star' : 'unstar' },
		important: { op: some((t) => !t.isImportant) ? 'markImportant' : 'markNotImportant' },
		mute: { op: some((t) => !t.isMuted) ? 'mute' : 'unmute' }
	} satisfies Record<string, ThreadOp>;
}

const LATER_TODAY_HOURS = 3;
const MORNING_HOUR = 8;
const MONDAY = 1;

/** Quick snooze times from `now`: later today, tomorrow morning, next Monday morning. */
export function snoozePresets(now: Date) {
	const later = new Date(now);
	later.setHours(later.getHours() + LATER_TODAY_HOURS, 0, 0, 0);
	const tomorrow = new Date(now);
	tomorrow.setDate(tomorrow.getDate() + 1);
	tomorrow.setHours(MORNING_HOUR, 0, 0, 0);
	const nextWeek = new Date(now);
	nextWeek.setDate(nextWeek.getDate() + ((MONDAY - nextWeek.getDay() + 7) % 7 || 7));
	nextWeek.setHours(MORNING_HOUR, 0, 0, 0);
	return [
		{ id: 'later', label: 'Later today', until: later },
		{ id: 'tomorrow', label: 'Tomorrow', until: tomorrow },
		{ id: 'next-week', label: 'Next week', until: nextWeek }
	];
}
