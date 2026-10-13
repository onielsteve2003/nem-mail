import { toSummary, type Message, type Thread } from '@nem/shared';
import { describe, expect, it, vi } from 'vitest';
import type { MailRepository } from '#lib/data/repositories.js';
import { draftText, oneLine, unreadIntro } from './assistant.js';
import { AIService } from './service.svelte.js';
import type { StorageEnv } from './storage.js';
import { createWorkerApi } from './worker/api.js';

const ME = { name: 'Alex Rivera', email: 'alex@nemmail.example' };
const ADA = { name: 'Ada Lovelace', email: 'ada@example.com' };
const USER = { id: 'u1', ...ME };
const SHOP = { name: 'Lumen', email: 'deals@lumen.example' };

function thread(id: string, from: typeof ADA, text: string, over: Partial<Thread> = {}): Thread {
	const message: Message = {
		id: `${id}m1`,
		threadId: id,
		from,
		to: [ME],
		cc: [],
		bcc: [],
		subject: `Subject ${id}`,
		bodyHtml: null,
		bodyText: text,
		snippet: text,
		sentAt: new Date(Date.now() - 3_600_000).toISOString(),
		sendAt: null,
		status: 'sent',
		inReplyTo: null,
		attachments: [],
		isRead: false
	};
	return {
		id,
		subject: message.subject,
		snippet: text,
		participants: [from],
		messageCount: 1,
		lastMessageAt: message.sentAt,
		mailboxes: ['inbox'],
		category: 'primary',
		labelIds: [],
		isUnread: true,
		isStarred: false,
		isImportant: false,
		isMuted: false,
		snoozedUntil: null,
		attachments: [],
		messages: [message],
		...over
	};
}

function setup(threads: Thread[]) {
	const env = {
		caches: { open: async () => ({ match: async () => undefined }) }
	} as never as StorageEnv;
	const models = { get: async () => undefined, put: async () => {} };
	const api = createWorkerApi(
		env,
		() => [],
		async () => 'wasm',
		models
	);
	const mail = {
		list: vi.fn(async (filter: { category?: string }) => ({
			items: threads
				.filter((t) => !filter.category || t.category === filter.category)
				.map(toSummary),
			nextCursor: null
		})),
		get: vi.fn(async (id: string) => threads.find((t) => t.id === id)!)
	} as unknown as MailRepository;
	const service = new AIService(null, async () => ({ api, terminate: vi.fn() }), null, mail);
	// Newest-first order keeps the test independent of the priority model.
	service.toggles.priority = false;
	return service;
}

describe('assistant helpers', () => {
	it('counts unread by tab and writes drafts and one-liners', () => {
		const a = toSummary(thread('a', ADA, 'Hi'));
		const b = toSummary(thread('b', SHOP, 'Sale', { category: 'promotions' }));
		expect(unreadIntro([a, b])).toBe(
			'You have 2 unread conversations: 1 in Primary and 1 in Promotions. The ones that look most important:'
		);
		expect(unreadIntro([])).toBe("You're all caught up. Nothing unread in your inbox.");
		expect(draftText('Sounds good!', 'Ada Lovelace', 'Alex Rivera')).toBe(
			'Hi Ada,\n\nSounds good!\n\nBest,\nAlex'
		);
		expect(oneLine('First one.  Second one.')).toBe('First one.');
	});
});

describe('AIService assistant', () => {
	const threads = [
		thread('t1', ADA, 'Are you free for lunch on Friday? There is a new place.'),
		thread('t2', SHOP, 'Up to 40% off everything.', { category: 'promotions' }),
		thread('t3', ADA, 'The release shipped this morning. Nothing to do.', { isUnread: false })
	];

	it('summarizes unread mail with counts and one line per conversation', async () => {
		const answer = await setup(threads).summarizeUnread(USER);
		expect(answer.text).toContain('You have 2 unread conversations');
		expect(answer.items.map((i) => i.threadId)).toEqual(['t1', 't2']);
		expect(answer.items[0]).toMatchObject({
			title: 'Ada Lovelace · Subject t1',
			detail: 'Are you free for lunch on Friday?'
		});
	});

	it('finds what needs a reply and drafts one for it', async () => {
		const service = setup(threads);
		const waiting = await service.needsReply(USER);
		expect(waiting.text).toBe('One conversation looks like it needs a reply:');
		expect(waiting.items.map((i) => i.threadId)).toEqual(['t1']);
		const draft = await service.draftReply(USER);
		expect(draft.draft).toMatchObject({ threadId: 't1', messageId: 't1m1' });
		expect(draft.draft?.text).toMatch(/^Hi Ada,\n\n.+\n\nBest,\nAlex$/);
	});

	it('says so when nothing needs a reply', async () => {
		const draft = await setup([threads[2]!]).draftReply(USER);
		expect(draft.draft).toBeNull();
		expect(draft.text).toBe('Nothing needs a reply right now, so there is nothing to draft.');
	});
});
