import type { Label, Message, Thread } from '@nem/shared';
import { describe, expect, it } from 'vitest';
import { buildIndex, hitKey, searchIndex, tokenize } from './search-index.js';

let seq = 0;
function message(over: Partial<Message> = {}): Message {
	return {
		id: `m${++seq}`,
		threadId: 't',
		from: { name: 'Ada Lovelace', email: 'ada@example.com' },
		to: [{ name: 'Me', email: 'me@example.com' }],
		cc: [],
		bcc: [],
		subject: '',
		bodyHtml: null,
		bodyText: '',
		snippet: '',
		sentAt: '2026-03-10T12:00:00.000Z',
		sendAt: null,
		status: 'sent',
		inReplyTo: null,
		attachments: [],
		isRead: true,
		...over
	};
}

function thread(id: string, subject: string, body: string, over: Partial<Thread> = {}): Thread {
	const messages = over.messages ?? [message({ subject, bodyText: body })];
	return {
		id,
		subject,
		snippet: body.slice(0, 40),
		participants: messages.map((m) => m.from),
		messageCount: messages.length,
		lastMessageAt: messages[messages.length - 1]?.sentAt ?? '2026-03-10T12:00:00.000Z',
		mailboxes: ['inbox'],
		category: 'primary',
		labelIds: [],
		isUnread: false,
		isStarred: false,
		isImportant: false,
		isMuted: false,
		snoozedUntil: null,
		attachments: [],
		...over,
		messages
	};
}

const labels: Label[] = [
	{ id: 'l1', name: 'Projects', color: 'neutral', parentId: null },
	{ id: 'l2', name: 'Side work', color: 'neutral', parentId: 'l1' }
];

const threads = [
	thread('a', 'Budget review', 'Numbers for the quarter.'),
	thread('b', 'Lunch', 'We should talk about the budget at lunch, and the quarterly plan.'),
	thread('c', 'Trip photos', 'Café pics attached', {
		messages: [
			message({
				from: { name: 'Grace Hopper', email: 'grace@navy.example' },
				to: [{ email: 'team@example.com' }],
				bodyText: 'Café pics attached',
				sentAt: '2026-01-02T12:00:00.000Z',
				attachments: [{ id: 'x1', filename: 'a.jpg', mime: 'image/jpeg', size: 10 }]
			})
		],
		isUnread: true,
		isStarred: true,
		labelIds: ['l2']
	}),
	thread('d', 'Budget spam', 'budget budget budget', { mailboxes: ['spam'] })
];
const index = buildIndex(threads);
const ids = (q: string) => searchIndex(index, q, labels).map((h) => h.summary.id);

describe('tokenize', () => {
	it('lowercases, folds accents and splits on punctuation', () => {
		expect(tokenize('Café, ADA@Example.com!')).toEqual(['cafe', 'ada', 'example', 'com']);
	});
});

describe('searchIndex', () => {
	it('ranks a subject hit above a body hit and skips Spam and Trash', () => {
		expect(ids('budget')).toEqual(['a', 'b']);
		const [first, second] = searchIndex(index, 'budget', labels);
		expect(first?.score).toBeGreaterThan(second?.score ?? Infinity);
	});

	it('needs every word, matches phrases in order and honours negation', () => {
		expect(ids('budget lunch')).toEqual(['b']);
		expect(ids('"quarterly plan"')).toEqual(['b']);
		expect(ids('"plan quarterly"')).toEqual([]);
		expect(ids('budget -lunch')).toEqual(['a']);
		expect(ids('cafe')).toEqual(['c']);
		expect(ids('nothing-here')).toEqual([]);
	});

	it('filters by every operator, newest first when there are no words', () => {
		expect(ids('from:grace')).toEqual(['c']);
		expect(ids('-from:grace')).toEqual(['b', 'a']);
		expect(ids('to:team')).toEqual(['c']);
		expect(ids('subject:"budget review"')).toEqual(['a']);
		expect(ids('has:attachment')).toEqual(['c']);
		expect(ids('is:unread')).toEqual(['c']);
		expect(ids('is:starred')).toEqual(['c']);
		expect(ids('is:read budget')).toEqual(['a', 'b']);
		expect(ids('label:side-work')).toEqual(['c']);
		expect(ids('label:projects/side')).toEqual([]);
		expect(ids('label:"projects/side work"')).toEqual(['c']);
		expect(ids('before:2026-02-01')).toEqual(['c']);
		expect(ids('after:2026-02-01 budget')).toEqual(['a', 'b']);
	});

	it('gives descending keys that follow the ranking', () => {
		const hits = searchIndex(index, 'budget', labels);
		const keys = hits.map(hitKey);
		expect([...keys].sort().reverse()).toEqual(keys);
	});
});
