import { describe, expect, it } from 'vitest';
import type { ThreadSummary } from '@nem/shared';
import { listTime, rowText, senderLine } from './format.js';

const ada = { email: 'ada@nem.dev', name: 'Ada Lovelace' };
const grace = { email: 'grace@nem.dev', name: 'Grace Hopper' };
const me = { email: 'demo@nem.dev', name: 'Demo User' };

describe('senderLine', () => {
	it('names one sender in full', () => {
		expect(senderLine([ada])).toBe('Ada Lovelace');
	});

	it('uses first names, once each, and "me" for the user', () => {
		expect(senderLine([ada, me, ada, grace], 'DEMO@nem.dev')).toBe('Ada, me, Grace');
	});

	it('falls back to the email local part and folds long lists', () => {
		const people = ['a', 'b', 'c', 'd'].map((n) => ({ email: `${n}@x.io` }));
		expect(senderLine([people[0]!])).toBe('a');
		expect(senderLine(people)).toBe('a .. c, d');
	});
});

describe('listTime', () => {
	const now = new Date(2026, 9, 12, 18, 0).getTime();

	it('shows the time today, the day this year, else a short date', () => {
		expect(listTime(new Date(2026, 9, 12, 9, 5).toISOString(), now, 'en-US')).toBe('9:05 AM');
		expect(listTime(new Date(2026, 2, 3).toISOString(), now, 'en-US')).toBe('Mar 3');
		expect(listTime(new Date(2024, 2, 3).toISOString(), now, 'en-US')).toBe('3/3/24');
	});
});

describe('rowText', () => {
	const now = new Date(2026, 9, 12, 9, 0).getTime();
	const thread = {
		participants: [me],
		recipients: [ada, me],
		lastMessageAt: new Date(2026, 9, 12, 17, 0).toISOString(),
		snoozedUntil: new Date(2026, 9, 14, 8, 0).toISOString()
	} as ThreadSummary;

	it('names who sent mail went to, never "me"', () => {
		expect(rowText('sent', thread, now, me.email)).toEqual({ sender: 'To: Ada Lovelace' });
	});

	it('shows when scheduled mail sends and when snoozed mail wakes', () => {
		expect(rowText('scheduled', thread, now, me.email, 'en-US').when?.text).toBe('Sends 5:00 PM');
		expect(rowText('snoozed', thread, now, me.email, 'en-US').when).toEqual({
			text: 'Until Oct 14',
			datetime: thread.snoozedUntil
		});
	});

	it('leaves other mailboxes alone', () => {
		expect(rowText('inbox', thread, now, me.email)).toEqual({});
		expect(rowText(null, thread, now, me.email)).toEqual({});
	});
});
