import type { Category, Label, ThreadOp, ThreadSummary } from '@nem/shared';
import type { TimePreset } from './time-picker.js';

/** Where "Move to" can send threads (FR-6.7). */
export type MoveTarget =
	| { kind: 'mailbox'; to: 'inbox' | 'archive' | 'spam' | 'trash' }
	| { kind: 'label'; labelId: string }
	| { kind: 'category'; category: Category };

/**
 * The ops for a move. Archive means filed nowhere, so it files in the inbox
 * first (that also takes mail out of Spam or Trash). A label works like a
 * folder: the label is added and the thread leaves the inbox. A category is
 * an inbox tab, so the thread goes to the inbox too.
 */
export function moveOps(target: MoveTarget): ThreadOp[] {
	switch (target.kind) {
		case 'mailbox':
			return target.to === 'archive'
				? [{ op: 'move', to: 'inbox' }, { op: 'archive' }]
				: [{ op: 'move', to: target.to }];
		case 'label':
			return [
				{ op: 'addLabels', labelIds: [target.labelId] },
				{ op: 'move', to: 'inbox' },
				{ op: 'archive' }
			];
		case 'category':
			return [
				{ op: 'move', to: 'inbox' },
				{ op: 'setCategory', category: target.category }
			];
	}
}

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
const SATURDAY = 6;
const SUNDAY = 0;

/** The next `weekday` (0 = Sunday) after today, at 08:00. */
function nextWeekday(now: Date, weekday: number): Date {
	const at = new Date(now);
	at.setDate(at.getDate() + ((weekday - at.getDay() + 7) % 7 || 7));
	at.setHours(MORNING_HOUR, 0, 0, 0);
	return at;
}

/**
 * Snooze presets from `now` (FR-6.3): later today (3 hours on, on the hour,
 * while that is still today), tomorrow morning, this weekend (Saturday
 * morning, on weekdays only) and next week (Monday morning).
 */
export function snoozePresets(now: Date): TimePreset[] {
	const later = new Date(now);
	later.setHours(later.getHours() + LATER_TODAY_HOURS, 0, 0, 0);
	const tomorrow = new Date(now);
	tomorrow.setDate(tomorrow.getDate() + 1);
	tomorrow.setHours(MORNING_HOUR, 0, 0, 0);
	const isWeekend = now.getDay() === SATURDAY || now.getDay() === SUNDAY;
	return [
		...(later.getDate() === now.getDate()
			? [{ id: 'later', label: 'Later today', at: later }]
			: []),
		{ id: 'tomorrow', label: 'Tomorrow', at: tomorrow },
		...(isWeekend
			? []
			: [{ id: 'weekend', label: 'This weekend', at: nextWeekday(now, SATURDAY) }]),
		{ id: 'next-week', label: 'Next week', at: nextWeekday(now, MONDAY) }
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
