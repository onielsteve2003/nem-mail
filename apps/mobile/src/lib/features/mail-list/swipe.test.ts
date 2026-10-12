import type { ThreadSummary } from '@nem/shared';
import { describe, expect, it } from 'vitest';
import {
	MAGNET_PX,
	dragOffset,
	isArmed,
	lockAxis,
	removesRow,
	shouldCommit,
	swipeOp,
	swipeSide
} from './swipe.js';

const WIDTH = 400;
const ACTIONS = { left: 'archive', right: 'toggleRead' } as const;

describe('swipe gesture math', () => {
	it('names the side from the drag direction', () => {
		expect(swipeSide(-5)).toBe('left');
		expect(swipeSide(5)).toBe('right');
		expect(swipeSide(0)).toBeNull();
	});

	it('locks to an axis only after a clear move', () => {
		expect(lockAxis(4, 2)).toBeNull();
		expect(lockAxis(20, 4)).toBe('x');
		expect(lockAxis(12, 10)).toBe('y');
		expect(lockAxis(2, 20)).toBe('y');
	});

	it('arms at the threshold and pulls the row past it', () => {
		expect(isArmed(-119, WIDTH)).toBe(false);
		expect(isArmed(-120, WIDTH)).toBe(true);
		expect(dragOffset(-100, WIDTH, ACTIONS)).toBe(-100);
		expect(dragOffset(-130, WIDTH, ACTIONS)).toBe(-130 - MAGNET_PX);
		expect(dragOffset(-500, WIDTH, ACTIONS)).toBe(-WIDTH);
	});

	it('keeps the row still toward a side set to none', () => {
		expect(dragOffset(150, WIDTH, { left: 'archive', right: 'none' })).toBe(0);
	});

	it('commits past the threshold or on a fling the same way', () => {
		expect(shouldCommit(-130, 0, WIDTH)).toBe(true);
		expect(shouldCommit(-40, -0.8, WIDTH)).toBe(true);
		expect(shouldCommit(-40, 0.8, WIDTH)).toBe(false);
		expect(shouldCommit(-40, -0.1, WIDTH)).toBe(false);
		expect(shouldCommit(0, 1, WIDTH)).toBe(false);
	});
});

describe('swipe actions', () => {
	const thread = { isUnread: true } as ThreadSummary;

	it('maps settings to thread ops', () => {
		expect(swipeOp('archive', thread)).toEqual({ op: 'archive' });
		expect(swipeOp('delete', thread)).toEqual({ op: 'trash' });
		expect(swipeOp('toggleRead', thread)).toEqual({ op: 'markRead' });
		expect(swipeOp('toggleRead', { ...thread, isUnread: false })).toEqual({ op: 'markUnread' });
		expect(swipeOp('snooze', thread)).toBeNull();
		expect(swipeOp('none', thread)).toBeNull();
	});

	it('flies the row off only for actions that remove it', () => {
		expect(removesRow('archive')).toBe(true);
		expect(removesRow('delete')).toBe(true);
		expect(removesRow('toggleRead')).toBe(false);
		expect(removesRow('snooze')).toBe(false);
	});
});
