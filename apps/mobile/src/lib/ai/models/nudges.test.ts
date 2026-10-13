import { toSummary, type Message, type Thread } from '@nem/shared';
import { describe, expect, it } from 'vitest';
import { followUpNudge, unsubscribeSuggestions } from './nudges';

const NOW = Date.UTC(2026, 9, 13, 12);
const DAY = 86_400_000;
const ME = { name: 'Alex', email: 'alex@nemmail.example' };
const ADA = { name: 'Ada Lovelace', email: 'ada@example.com' };

function message(over: Partial<Message> = {}): Message {
	return {
		id: 'm1',
		threadId: 't1',
		from: ME,
		to: [ADA],
		cc: [],
		bcc: [],
		subject: 'Budget',
		bodyHtml: null,
		bodyText: 'Please send the numbers when you can.',
		snippet: '',
		sentAt: new Date(NOW - 4 * DAY).toISOString(),
		sendAt: null,
		status: 'sent',
		inReplyTo: null,
		attachments: [],
		isRead: true,
		...over
	};
}

function thread(messages: Message[], over: Partial<Thread> = {}): Thread {
	const last = messages.at(-1)!;
	return {
		id: last.threadId,
		subject: last.subject,
		snippet: '',
		participants: messages.map((m) => m.from),
		messageCount: messages.length,
		lastMessageAt: last.sentAt,
		mailboxes: ['sent'],
		category: null,
		labelIds: [],
		isUnread: false,
		isStarred: false,
		isImportant: false,
		isMuted: false,
		snoozedUntil: null,
		attachments: [],
		messages,
		...over
	};
}

describe('followUpNudge', () => {
	it('nudges an unanswered question or request after 3 days', () => {
		const nudge = followUpNudge(thread([message()]), ME.email, NOW);
		expect(nudge?.value).toEqual({
			threadId: 't1',
			messageId: 'm1',
			subject: 'Budget',
			to: 'Ada',
			days: 4
		});
		expect(nudge?.explanation).toBe('You made a request 4 days ago and nobody has replied since.');
		const question = message({ bodyText: 'Is Friday still on?' });
		expect(followUpNudge(thread([question]), ME.email, NOW)?.confidence).toBe(0.8);
	});

	it('stays quiet when they replied, it is too soon or too old, or nothing was asked', () => {
		const reply = message({ id: 'm2', from: ADA, to: [ME] });
		expect(followUpNudge(thread([message(), reply]), ME.email, NOW)).toBeNull();
		const soon = message({ sentAt: new Date(NOW - 2 * DAY).toISOString() });
		expect(followUpNudge(thread([soon]), ME.email, NOW)).toBeNull();
		const old = message({ sentAt: new Date(NOW - 40 * DAY).toISOString() });
		expect(followUpNudge(thread([old]), ME.email, NOW)).toBeNull();
		const statement = message({ bodyText: 'Here are the numbers. Cheers.' });
		expect(followUpNudge(thread([statement]), ME.email, NOW)).toBeNull();
		const noReply = message({ to: [{ name: 'Bot', email: 'no-reply@shop.example' }] });
		expect(followUpNudge(thread([noReply]), ME.email, NOW)).toBeNull();
	});
});

describe('unsubscribeSuggestions', () => {
	const NEWS = { name: 'Runners Club', email: 'list@runners.example' };
	const bulk = (i: number, isUnread: boolean, category: Thread['category'] = 'forums') =>
		toSummary(
			thread([message({ id: `n${i}`, threadId: `n${i}`, from: NEWS, to: [ME] })], {
				mailboxes: ['inbox'],
				category,
				isUnread,
				lastMessageAt: new Date(NOW - i * DAY).toISOString()
			})
		);

	it('suggests a newsletter opened at most half the time, with its inbox threads', () => {
		const threads = [1, 2, 3, 4, 5, 6].map((i) => bulk(i, i > 2));
		const [suggestion] = unsubscribeSuggestions(threads, ME.email, NOW);
		expect(suggestion?.value).toMatchObject({ name: 'Runners Club', total: 6, opened: 2 });
		expect(suggestion?.value.inboxThreadIds).toHaveLength(6);
		expect(suggestion?.explanation).toBe(
			'You opened 2 of 6 emails from this sender in the last 30 days.'
		);
	});

	it('leaves alone mail the user reads, small senders, and the Updates tab', () => {
		expect(
			unsubscribeSuggestions(
				[1, 2, 3, 4, 5].map((i) => bulk(i, i > 4)),
				ME.email,
				NOW
			)
		).toEqual([]);
		expect(
			unsubscribeSuggestions(
				[1, 2, 3, 4].map((i) => bulk(i, true)),
				ME.email,
				NOW
			)
		).toEqual([]);
		const updates = [1, 2, 3, 4, 5].map((i) => bulk(i, true, 'updates'));
		expect(unsubscribeSuggestions(updates, ME.email, NOW)).toEqual([]);
	});
});
