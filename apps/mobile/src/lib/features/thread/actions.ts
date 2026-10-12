import type { ThreadOp } from '@nem/shared';

/** Ops that take the thread out of the view it was opened from, or (unread) mean "later". */
const LEAVING_OPS: ReadonlySet<ThreadOp['op']> = new Set([
	'archive',
	'trash',
	'spam',
	'notSpam',
	'move',
	'snooze',
	'mute',
	'markUnread'
]);

/** Whether the thread view should close after this op, the way mail apps return to the list. */
export function leavesThread(op: ThreadOp): boolean {
	return LEAVING_OPS.has(op.op);
}
