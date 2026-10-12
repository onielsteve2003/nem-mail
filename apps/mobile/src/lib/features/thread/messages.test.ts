import type { Message } from '@nem/shared';
import { describe, expect, it } from 'vitest';
import {
	initialExpanded,
	messageLayout,
	messageTime,
	recipientLine,
	type MessageItem
} from './messages.js';

const SELF = 'me@nem.mail';

function message(id: string, overrides: Partial<Message> = {}): Message {
	return {
		id,
		from: { email: 'ada@example.com', name: 'Ada Lovelace' },
		to: [{ email: SELF, name: 'Me' }],
		cc: [],
		bcc: [],
		isRead: true,
		...overrides
	} as Message;
}

const ids = (items: MessageItem[]) =>
	items.map((item) => (item.kind === 'message' ? item.message.id : `+${item.count}`));

describe('thread messages', () => {
	it('opens the latest message and unread ones', () => {
		const list = [message('a'), message('b', { isRead: false }), message('c')];
		expect(initialExpanded(list)).toEqual(['b', 'c']);
	});

	it('folds the middle of long threads into a group until shown', () => {
		const short = ['a', 'b', 'c', 'd'].map((id) => message(id));
		expect(ids(messageLayout(short, false))).toEqual(['a', 'b', 'c', 'd']);
		const long = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => message(id));
		expect(ids(messageLayout(long, false))).toEqual(['a', '+3', 'e', 'f']);
		expect(ids(messageLayout(long, true))).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
	});

	it('names recipients, with the user as "me" and Bcc only on sent mail', () => {
		const cc = [{ email: 'grace@example.com', name: 'Grace Hopper' }];
		const bcc = [{ email: 'alan@example.com' }];
		expect(recipientLine(message('a', { cc, bcc }), SELF)).toBe('to me, Grace Hopper');
		const sent = message('b', { from: { email: SELF }, to: cc, bcc });
		expect(recipientLine(sent, SELF)).toBe('to Grace Hopper, alan');
	});

	it('shows the clock today and the date otherwise', () => {
		const now = Date.parse('2026-10-12T15:00:00');
		expect(messageTime('2026-10-12T09:05:00', now, 'en-US')).toBe('9:05 AM');
		expect(messageTime('2026-10-03T09:05:00', now, 'en-US')).toBe('Oct 3, 9:05 AM');
		expect(messageTime('2025-10-03T09:05:00', now, 'en-US')).toBe('Oct 3, 2025, 9:05 AM');
	});
});
