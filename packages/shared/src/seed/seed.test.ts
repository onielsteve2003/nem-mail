import { describe, expect, it } from 'vitest';
import {
	ContactSchema,
	DraftSchema,
	LabelSchema,
	SettingsSchema,
	ThreadSchema,
	UserSchema
} from '../schemas';
import { createRng, generateSeed, hashSeed } from './index';

const now = new Date('2026-10-11T09:30:00.000Z');
const data = generateSeed({ now });
const [personal, work] = data.accounts;

describe('prng', () => {
	it('repeats for a seed and differs across seeds', () => {
		const run = (seed: string) => Array.from({ length: 5 }, createRng(seed).next);
		expect(run('a')).toEqual(run('a'));
		expect(run('a')).not.toEqual(run('b'));
		expect(hashSeed('nem')).toBe(hashSeed('nem'));
	});

	it('keeps int, pick and sample in range', () => {
		const rng = createRng('range');
		for (let i = 0; i < 200; i++) {
			const n = rng.int(3, 5);
			expect(n).toBeGreaterThanOrEqual(3);
			expect(n).toBeLessThanOrEqual(5);
		}
		const sample = rng.sample([1, 2, 3, 4], 3);
		expect(new Set(sample).size).toBe(3);
		expect(() => rng.pick([])).toThrow();
	});
});

describe('generateSeed', () => {
	it('is deterministic for the same seed and now', () => {
		expect(generateSeed({ now })).toEqual(data);
		expect(generateSeed({ now, seed: 'other' })).not.toEqual(data);
	});

	it('produces valid domain objects', () => {
		for (const account of data.accounts) {
			UserSchema.parse(account.user);
			SettingsSchema.parse(account.settings);
			for (const label of account.labels) LabelSchema.parse(label);
			for (const contact of account.contacts) ContactSchema.parse(contact);
			for (const draft of account.drafts) DraftSchema.parse(draft);
			for (const thread of account.threads) ThreadSchema.parse(thread);
		}
	});

	it('has the planned volume: 2 accounts, about 40 contacts and 400 threads', () => {
		expect(data.accounts).toHaveLength(2);
		const threads = data.accounts.reduce((sum, a) => sum + a.threads.length, 0);
		expect(threads).toBeGreaterThanOrEqual(380);
		expect(threads).toBeLessThanOrEqual(420);
		expect(personal?.contacts.length).toBeGreaterThanOrEqual(30);
		expect(personal?.contacts.length).toBeLessThanOrEqual(40);
	});

	it('fills every mailbox and category the UI shows', () => {
		const threads = personal?.threads ?? [];
		for (const mailbox of ['inbox', 'sent', 'spam', 'trash', 'scheduled']) {
			expect(threads.some((t) => t.mailboxes.includes(mailbox as never))).toBe(true);
		}
		for (const category of ['primary', 'promotions', 'social', 'updates', 'forums']) {
			expect(threads.some((t) => t.category === category)).toBe(true);
		}
		expect(threads.some((t) => t.mailboxes.length === 0)).toBe(true); // archived
		expect(threads.some((t) => t.snoozedUntil)).toBe(true);
		expect(threads.some((t) => t.isMuted)).toBe(true);
		expect(threads.some((t) => t.isUnread)).toBe(true);
		expect(threads.some((t) => t.attachments.length > 0)).toBe(true);
		expect(threads.some((t) => t.messages.some((m) => m.bodyHtml === null))).toBe(true);
		expect(threads.some((t) => t.messages.some((m) => m.bodyHtml !== null))).toBe(true);
		expect(personal?.drafts.length).toBe(3);
	});

	it('dates mail relative to now, newest first; only scheduled mail is in the future', () => {
		for (const account of data.accounts) {
			const dates = account.threads.map((t) => t.lastMessageAt);
			expect([...dates].sort().reverse()).toEqual(dates);
			for (const thread of account.threads) {
				const future = thread.lastMessageAt > now.toISOString();
				expect(future).toBe(thread.mailboxes.includes('scheduled'));
			}
		}
	});

	it('only references labels the account owns', () => {
		for (const account of data.accounts) {
			const ids = new Set(account.labels.map((l) => l.id));
			for (const thread of account.threads) {
				for (const id of thread.labelIds) expect(ids.has(id)).toBe(true);
			}
		}
		expect(work?.labels.map((l) => l.name)).toEqual(['Work', 'Projects']);
	});
});
