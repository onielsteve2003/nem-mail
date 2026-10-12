import type { Label, ThreadOp, ThreadSummary } from '@nem/shared';

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

/** Whether every, some or none of the threads carry a label (a tri-state checkbox). */
export type LabelState = 'all' | 'some' | 'none';

/** Each label's state across the threads, by label id. */
export function labelStates(
	threads: readonly ThreadSummary[],
	labelIds: readonly string[]
): Record<string, LabelState> {
	return Object.fromEntries(
		labelIds.map((id) => {
			const count = threads.filter((thread) => thread.labelIds.includes(id)).length;
			const state: LabelState = count === 0 ? 'none' : count === threads.length ? 'all' : 'some';
			return [id, state];
		})
	);
}

/**
 * The ops that take the threads from `initial` to `chosen`. A label still
 * `some` is left alone, so threads keep it or not as they were.
 */
export function labelChangeOps(
	initial: Record<string, LabelState>,
	chosen: Record<string, LabelState>
): ThreadOp[] {
	const changed = (state: LabelState) =>
		Object.keys(chosen).filter((id) => chosen[id] === state && initial[id] !== state);
	const add = changed('all');
	const remove = changed('none');
	return [
		...(add.length > 0 ? [{ op: 'addLabels' as const, labelIds: add }] : []),
		...(remove.length > 0 ? [{ op: 'removeLabels' as const, labelIds: remove }] : [])
	];
}

/** Labels whose name contains `query` (ignoring case), each child after its parent. */
export function filterLabels(labels: readonly Label[], query: string): Label[] {
	const q = query.trim().toLowerCase();
	const byName = (a: Label, b: Label) => a.name.localeCompare(b.name);
	const parents = labels.filter((label) => label.parentId === null).sort(byName);
	const ordered = parents.flatMap((parent) => [
		parent,
		...labels.filter((label) => label.parentId === parent.id).sort(byName)
	]);
	// Children whose parent is gone still show, at the end.
	const orphans = labels.filter(
		(l) => l.parentId !== null && !parents.some((p) => p.id === l.parentId)
	);
	return [...ordered, ...orphans].filter((label) => label.name.toLowerCase().includes(q));
}
