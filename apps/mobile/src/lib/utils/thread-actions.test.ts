import type { ThreadSummary } from '@nem/shared';
import { describe, expect, it } from 'vitest';
import { bulkToggles, snoozePresets } from './thread-actions.js';

const thread = (overrides: Partial<ThreadSummary>) =>
	({
		isUnread: false,
		isStarred: false,
		isImportant: false,
		isMuted: false,
		...overrides
	}) as ThreadSummary;

describe('bulkToggles', () => {
	it('applies while any thread still needs it', () => {
		const ops = bulkToggles([thread({ isUnread: true, isStarred: true }), thread({})]);
		expect(ops.read.op).toBe('markRead');
		expect(ops.star.op).toBe('star');
		expect(ops.important.op).toBe('markImportant');
		expect(ops.mute.op).toBe('mute');
	});

	it('undoes when every thread already has it', () => {
		const all = thread({ isStarred: true, isImportant: true, isMuted: true });
		const ops = bulkToggles([all, all]);
		expect(ops.read.op).toBe('markUnread');
		expect(ops.star.op).toBe('unstar');
		expect(ops.important.op).toBe('markNotImportant');
		expect(ops.mute.op).toBe('unmute');
	});
});

describe('snoozePresets', () => {
	it('offers later today, tomorrow morning and next Monday morning', () => {
		// Wednesday 14 Oct 2026, 10:20.
		const [later, tomorrow, nextWeek] = snoozePresets(new Date(2026, 9, 14, 10, 20));
		expect(later?.until).toEqual(new Date(2026, 9, 14, 13, 0));
		expect(tomorrow?.until).toEqual(new Date(2026, 9, 15, 8, 0));
		expect(nextWeek?.until).toEqual(new Date(2026, 9, 19, 8, 0));
	});

	it('skips to the following Monday when today is Monday', () => {
		const nextWeek = snoozePresets(new Date(2026, 9, 12, 9, 0))[2];
		expect(nextWeek?.until).toEqual(new Date(2026, 9, 19, 8, 0));
	});
});
