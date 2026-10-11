import { describe, expect, it } from 'vitest';
import {
	AccountSchema,
	AIInsightsSchema,
	AI_FEATURES,
	ContactSchema,
	DEFAULT_SETTINGS,
	DraftSchema,
	LabelSchema,
	MAX_ATTACHMENT_BYTES,
	MessageSchema,
	SettingsSchema,
	STORED_MAILBOXES,
	SYSTEM_MAILBOXES,
	ThreadSchema,
	ThreadSummarySchema,
	UserSchema,
	type Message,
	type ThreadSummary
} from './index';

const NOW = '2026-10-11T09:30:00.000Z';
const ada = { email: 'ada@example.com', name: 'Ada Lovelace' };
const grace = { email: 'grace@example.com' };

const message: Message = {
	id: 'm1',
	threadId: 't1',
	from: ada,
	to: [grace],
	cc: [],
	bcc: [],
	subject: 'Engine notes',
	bodyHtml: '<p>Hello</p>',
	bodyText: 'Hello',
	snippet: 'Hello',
	sentAt: NOW,
	sendAt: null,
	status: 'sent',
	inReplyTo: null,
	attachments: [{ id: 'a1', filename: 'notes.pdf', mime: 'application/pdf', size: 2048 }],
	isRead: false
};

const summary: ThreadSummary = {
	id: 't1',
	subject: 'Engine notes',
	snippet: 'Hello',
	participants: [ada],
	messageCount: 1,
	lastMessageAt: NOW,
	mailboxes: ['inbox'],
	category: 'primary',
	labelIds: ['l1'],
	isUnread: true,
	isStarred: false,
	isImportant: true,
	isMuted: false,
	snoozedUntil: null,
	attachments: [{ filename: 'notes.pdf', mime: 'application/pdf' }]
};

describe('user schemas', () => {
	it('parses a user, an account and a contact', () => {
		const user = { id: 'u1', email: ada.email, name: 'Ada', avatarSeed: 'ada', createdAt: NOW };
		expect(UserSchema.parse(user)).toEqual(user);
		expect(AccountSchema.parse({ ...user, signedInAt: NOW })).not.toHaveProperty('createdAt');
		expect(
			ContactSchema.parse({ id: 'c1', email: grace.email, lastContactedAt: null, frequency: 0 })
		).toBeTruthy();
	});

	it('rejects a bad email and a timestamp without a timezone', () => {
		const base = { id: 'u1', name: 'Ada', avatarSeed: 'ada' };
		expect(UserSchema.safeParse({ ...base, email: 'nope', createdAt: NOW }).success).toBe(false);
		expect(
			UserSchema.safeParse({ ...base, email: ada.email, createdAt: '2026-10-11 09:30' }).success
		).toBe(false);
	});
});

describe('label schema', () => {
	it('trims names and rejects empty ones or unknown colors', () => {
		const label = LabelSchema.parse({ id: 'l1', name: '  Work ', color: 'lime', parentId: null });
		expect(label.name).toBe('Work');
		expect(LabelSchema.safeParse({ ...label, name: '   ' }).success).toBe(false);
		expect(LabelSchema.safeParse({ ...label, color: 'red' }).success).toBe(false);
	});
});

describe('mailboxes', () => {
	it('stores only real mailboxes; starred, snoozed, important and all are views', () => {
		for (const mailbox of STORED_MAILBOXES) expect(SYSTEM_MAILBOXES).toContain(mailbox);
		for (const view of ['starred', 'snoozed', 'important', 'all']) {
			expect(STORED_MAILBOXES).not.toContain(view);
		}
	});
});

describe('mail schemas', () => {
	it('parses a message, a summary and a thread', () => {
		expect(MessageSchema.parse(message)).toEqual(message);
		expect(ThreadSummarySchema.parse(summary)).toEqual(summary);
		expect(ThreadSchema.parse({ ...summary, messages: [message] }).messages).toHaveLength(1);
	});

	it('enforces the attachment size limit', () => {
		const big = { id: 'a2', filename: 'big.zip', mime: 'application/zip' };
		const at = (size: number) => ({ ...message, attachments: [{ ...big, size }] });
		expect(MessageSchema.safeParse(at(MAX_ATTACHMENT_BYTES)).success).toBe(true);
		expect(MessageSchema.safeParse(at(MAX_ATTACHMENT_BYTES + 1)).success).toBe(false);
	});

	it('rejects a thread without messages or a summary in a view mailbox', () => {
		expect(ThreadSchema.safeParse({ ...summary, messages: [] }).success).toBe(false);
		expect(ThreadSummarySchema.safeParse({ ...summary, mailboxes: ['starred'] }).success).toBe(
			false
		);
	});
});

describe('draft schema', () => {
	it('parses a reply draft', () => {
		const draft = {
			id: 'd1',
			mode: 'reply',
			threadId: 't1',
			inReplyTo: 'm1',
			to: [ada],
			cc: [],
			bcc: [],
			subject: 'Re: Engine notes',
			bodyHtml: '<p>Thanks</p>',
			attachments: [],
			scheduledAt: null,
			updatedAt: NOW
		};
		expect(DraftSchema.parse(draft)).toEqual(draft);
		expect(DraftSchema.safeParse({ ...draft, mode: 'redirect' }).success).toBe(false);
	});
});

describe('AI insights', () => {
	it('parses insights with confidence, explanation and source', () => {
		const insights = {
			category: {
				value: 'social',
				confidence: 0.8,
				explanation: 'From a network',
				source: 'model'
			},
			spam: {
				value: { isSpam: true, isPhishing: false },
				confidence: 0.92,
				explanation: 'Top words: prize, claim',
				source: 'model'
			}
		};
		expect(AIInsightsSchema.parse(insights)).toEqual(insights);
	});

	it('rejects a confidence outside 0 to 1 and more than 3 smart replies', () => {
		const insight = { explanation: '', source: 'heuristic' };
		expect(
			AIInsightsSchema.safeParse({ priority: { ...insight, value: 0.5, confidence: 1.2 } }).success
		).toBe(false);
		expect(
			AIInsightsSchema.safeParse({
				smartReplies: { ...insight, value: ['a', 'b', 'c', 'd'], confidence: 1 }
			}).success
		).toBe(false);
	});
});

describe('settings schema', () => {
	it('fills every default from an empty object', () => {
		expect(DEFAULT_SETTINGS.theme).toBe('dark');
		expect(DEFAULT_SETTINGS.swipe).toEqual({ left: 'archive', right: 'toggleRead' });
		expect(Object.keys(DEFAULT_SETTINGS.ai)).toEqual([...AI_FEATURES]);
		expect(Object.values(DEFAULT_SETTINGS.ai).every(Boolean)).toBe(true);
		expect(DEFAULT_SETTINGS.vacation.enabled).toBe(false);
	});

	it('keeps saved values and adds missing ones', () => {
		const settings = SettingsSchema.parse({ density: 'compact', ai: { spam: false } });
		expect(settings.density).toBe('compact');
		expect(settings.ai.spam).toBe(false);
		expect(settings.ai.summary).toBe(true);
		expect(settings.confirm.delete).toBe(true);
	});

	it('rejects unknown swipe actions', () => {
		expect(SettingsSchema.safeParse({ swipe: { left: 'explode' } }).success).toBe(false);
	});
});
