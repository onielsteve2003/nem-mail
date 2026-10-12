import { describe, expect, it } from 'vitest';
import { leavesThread } from './actions.js';

describe('leavesThread', () => {
	it('closes for ops that move the thread away or mark it unread', () => {
		expect(leavesThread({ op: 'archive' })).toBe(true);
		expect(leavesThread({ op: 'move', to: 'inbox' })).toBe(true);
		expect(leavesThread({ op: 'markUnread' })).toBe(true);
	});

	it('stays open for in-place changes', () => {
		expect(leavesThread({ op: 'star' })).toBe(false);
		expect(leavesThread({ op: 'addLabels', labelIds: ['l1'] })).toBe(false);
		expect(leavesThread({ op: 'markImportant' })).toBe(false);
	});
});
