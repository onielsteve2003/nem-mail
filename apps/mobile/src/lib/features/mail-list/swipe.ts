import type { SwipeAction, ThreadOp, ThreadSummary } from '@nem/shared';

/** Share of the row's width a drag must cross to trigger its action. */
export const SWIPE_THRESHOLD = 0.3;
/** A drag this long decides whether the gesture is a swipe or a scroll. */
export const LOCK_DISTANCE_PX = 10;
/** Horizontal must beat vertical by this much to count as a swipe. */
export const LOCK_RATIO = 1.5;
/** A release this fast (px/ms) toward a side triggers it even short of the threshold. */
export const FLING_VELOCITY = 0.6;
/** The magnetic jump: past the threshold the row leaps this much further. */
export const MAGNET_PX = 24;

/** Which way the row moves: `left` uses the left-swipe setting. */
export type SwipeSide = 'left' | 'right';

export function swipeSide(dx: number): SwipeSide | null {
	if (dx < 0) return 'left';
	if (dx > 0) return 'right';
	return null;
}

/** Decides a gesture's axis once it has moved far enough, or null while still unclear. */
export function lockAxis(dx: number, dy: number): 'x' | 'y' | null {
	if (Math.hypot(dx, dy) < LOCK_DISTANCE_PX) return null;
	return Math.abs(dx) > Math.abs(dy) * LOCK_RATIO ? 'x' : 'y';
}

export function isArmed(dx: number, width: number): boolean {
	return width > 0 && Math.abs(dx) >= width * SWIPE_THRESHOLD;
}

/**
 * Where the row sits for a finger offset: still on a side set to `none`,
 * pulled a little further once armed (the magnet), never off the row.
 */
export function dragOffset(
	dx: number,
	width: number,
	actions: Record<SwipeSide, SwipeAction>
): number {
	const side = swipeSide(dx);
	if (!side || actions[side] === 'none') return 0;
	const pulled = isArmed(dx, width) ? dx + Math.sign(dx) * MAGNET_PX : dx;
	return Math.max(-width, Math.min(width, pulled));
}

/** On release: past the threshold, or flung toward the side it was dragged to. */
export function shouldCommit(dx: number, velocity: number, width: number): boolean {
	if (dx === 0) return false;
	if (isArmed(dx, width)) return true;
	return Math.abs(velocity) >= FLING_VELOCITY && Math.sign(velocity) === Math.sign(dx);
}

/** Actions that take the row out of the list, so it flies off instead of springing back. */
export function removesRow(action: SwipeAction): boolean {
	return action === 'archive' || action === 'delete';
}

/** The thread op a swipe performs directly. Snooze and move need a picker, so they have none. */
export function swipeOp(action: SwipeAction, thread: ThreadSummary): ThreadOp | null {
	switch (action) {
		case 'archive':
			return { op: 'archive' };
		case 'delete':
			return { op: 'trash' };
		case 'toggleRead':
			return { op: thread.isUnread ? 'markRead' : 'markUnread' };
		default:
			return null;
	}
}
