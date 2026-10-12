import 'fake-indexeddb/auto';
import { DEFAULT_SETTINGS, type Draft, type ServerEvent } from '@nem/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ARRIVAL_MEAN_MS, MockMailSimulator, TICK_MS } from './arrival.js';
import { DEMO_EMAIL, DEMO_WORK_EMAIL, MockAuthRepository } from './auth.js';
import { MockContactRepository } from './contacts.js';
import { MockContext } from './context.js';
import { openMockDb, seedIfEmpty, type MockDb } from './db.js';
import { MockDraftRepository, SEND_DELAY_MS } from './drafts.js';
import { MockLabelRepository } from './labels.js';
import { MockMailRepository } from './mail.js';
import { MockSettingsRepository } from './settings.js';

const START = Date.parse('2026-10-11T09:00:00.000Z');
let n = 0;
let now = START;
let db: MockDb;
let ctx: MockContext;

beforeEach(async () => {
	now = START;
	db = await openMockDb(`repos-${++n}`);
	await seedIfEmpty(db, { now: new Date(START) });
	ctx = new MockContext({ db: async () => db, now: () => now, latency: { min: 0, max: 0 } });
});

afterEach(() => {
	vi.useRealTimers();
	db.close();
});

const PASSWORD = 'anything-goes';

describe('MockAuthRepository', () => {
	it('signs in a demo account, restores it, switches and signs out', async () => {
		const auth = new MockAuthRepository(ctx);
		expect(await auth.me()).toBeNull();
		await expect(
			auth.signIn({ email: 'who@else.example', password: PASSWORD })
		).rejects.toMatchObject({ code: 'UNAUTHORIZED' });

		const session = await auth.signIn({ email: DEMO_EMAIL, password: PASSWORD });
		expect(session.user.id).toBe('u1');
		expect(Date.parse(session.expiresAt)).toBeGreaterThan(START);
		await auth.signIn({ email: DEMO_WORK_EMAIL.toUpperCase(), password: PASSWORD });
		expect(ctx.userId).toBe('u2');

		// A new page load (fresh context) picks the session back up.
		const reloaded = new MockContext({ db: async () => db, latency: { min: 0, max: 0 } });
		const restored = new MockAuthRepository(reloaded);
		expect((await restored.me())?.id).toBe('u2');
		expect((await restored.listAccounts()).map((a) => a.id)).toEqual(['u1', 'u2']);

		expect((await restored.switchAccount('u1')).id).toBe('u1');
		await expect(restored.switchAccount('nobody')).rejects.toMatchObject({ code: 'NOT_FOUND' });

		await restored.signOut();
		expect(reloaded.userId).toBe('u2');
		await restored.signOut();
		expect(reloaded.userId).toBeNull();
		expect(await restored.me()).toBeNull();
	});

	it('signs up a new empty account and rejects a taken email', async () => {
		const auth = new MockAuthRepository(ctx);
		const { user } = await auth.signUp({ name: 'Sam', email: 'sam@x.example', password: PASSWORD });
		expect(ctx.userId).toBe(user.id);
		const mail = new MockMailRepository(ctx);
		expect((await mail.list({ mailbox: 'inbox' })).items).toEqual([]);
		expect(await new MockSettingsRepository(ctx).get()).toEqual(DEFAULT_SETTINGS);
		await expect(
			auth.signUp({ name: 'Al', email: DEMO_EMAIL, password: PASSWORD })
		).rejects.toMatchObject({ code: 'CONFLICT' });
		await expect(auth.signUp({ name: 'Al', email: 'bad', password: 'x' })).rejects.toMatchObject({
			code: 'VALIDATION_FAILED'
		});
	});
});

describe('MockLabelRepository', () => {
	beforeEach(() => {
		ctx.userId = 'u1';
	});

	it('creates, renames and nests labels one level deep', async () => {
		const labels = new MockLabelRepository(ctx);
		const seeded = await labels.list();
		expect(seeded.map((l) => l.name)).toEqual([...seeded.map((l) => l.name)].sort());

		const trips = await labels.create({ name: 'Trips', color: 'cyan', parentId: null });
		await expect(
			labels.create({ name: 'trips', color: 'lime', parentId: null })
		).rejects.toMatchObject({ code: 'CONFLICT' });
		const japan = await labels.create({ name: 'Japan', color: 'cyan', parentId: trips.id });
		await expect(
			labels.create({ name: 'Tokyo', color: 'cyan', parentId: japan.id })
		).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });

		expect((await labels.update(japan.id, { name: 'Kyoto' })).name).toBe('Kyoto');
		await expect(labels.update('nope', { name: 'x' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
	});

	it('removes a label from threads and lifts its children', async () => {
		const labels = new MockLabelRepository(ctx);
		const mail = new MockMailRepository(ctx);
		const all = await labels.list();
		const withChild = all.find((l) => all.some((c) => c.parentId === l.id));
		expect(withChild).toBeDefined();
		const id = withChild?.id ?? '';
		const tagged = (await mail.list({ labelId: id }, { limit: 100 })).items;
		expect(tagged.length).toBeGreaterThan(0);

		await labels.remove(id);
		const after = await labels.list();
		expect(after.some((l) => l.id === id)).toBe(false);
		expect(after.some((l) => l.parentId === id)).toBe(false);
		expect((await mail.get(tagged[0]?.id ?? '')).labelIds).not.toContain(id);
		await expect(labels.remove('u2-l1')).rejects.toMatchObject({ code: 'NOT_FOUND' });
	});
});

describe('MockContactRepository', () => {
	it('finds contacts by name or email, most frequent first', async () => {
		ctx.userId = 'u1';
		const contacts = new MockContactRepository(ctx);
		const top = await contacts.search({});
		expect(top).toHaveLength(8);
		const freq = top.map((c) => c.frequency);
		expect(freq).toEqual([...freq].sort((a, b) => b - a));

		const first = top[0];
		const byName = await contacts.search({ q: first?.name?.split(' ')[0]?.toUpperCase() ?? '' });
		expect(byName.map((c) => c.id)).toContain(first?.id);
		expect(await contacts.search({ q: 'zzzz-nobody' })).toEqual([]);
		expect(top[0]).not.toHaveProperty('ownerId');
	});
});

describe('MockSettingsRepository', () => {
	it('saves valid settings and rejects invalid ones', async () => {
		ctx.userId = 'u1';
		const settings = new MockSettingsRepository(ctx);
		const next = { ...(await settings.get()), density: 'compact' as const };
		await settings.save(next);
		expect((await settings.get()).density).toBe('compact');
		await expect(
			settings.save({ ...next, theme: 'neon' } as unknown as typeof next)
		).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
	});
});

function draft(overrides: Partial<Draft> = {}): Draft {
	return {
		id: 'u1-dnew',
		mode: 'new',
		threadId: null,
		inReplyTo: null,
		to: [{ email: 'ada@example.com', name: 'Ada' }],
		cc: [],
		bcc: [],
		subject: 'Hello',
		bodyHtml: '<p>Hi <b>Ada</b></p>',
		attachments: [],
		scheduledAt: null,
		updatedAt: new Date(START).toISOString(),
		...overrides
	};
}

describe('MockDraftRepository', () => {
	beforeEach(() => {
		ctx.userId = 'u1';
	});

	it('lists, saves and removes drafts', async () => {
		const drafts = new MockDraftRepository(ctx);
		const seeded = await drafts.list();
		expect(seeded).toHaveLength(3);
		await drafts.save(draft({ updatedAt: new Date(START + 1000).toISOString() }));
		expect((await drafts.list())[0]?.id).toBe('u1-dnew');
		await drafts.remove('u1-dnew');
		await expect(drafts.get('u1-dnew')).rejects.toMatchObject({ code: 'NOT_FOUND' });
		await expect(drafts.save({ ...draft(), id: '' })).rejects.toMatchObject({
			code: 'VALIDATION_FAILED'
		});
		ctx.userId = 'u2';
		await expect(drafts.save(draft({ id: 'u1-d1' }))).rejects.toMatchObject({ code: 'FORBIDDEN' });
	});

	it('stores uploads and refuses files over 10 MB', async () => {
		const drafts = new MockDraftRepository(ctx);
		const file = new File(['hello'], 'note.txt', { type: 'text/plain' });
		const attachment = await drafts.uploadAttachment(file);
		expect(attachment).toMatchObject({ filename: 'note.txt', mime: 'text/plain', size: 5 });
		expect(await db.get('blobs', attachment.id)).toBeDefined();
		const read = await new MockMailRepository(ctx).getAttachment(attachment.id);
		expect(read.type).toBe('text/plain');
		expect(await read.text()).toBe('hello');

		const big = new File(['x'], 'big.bin');
		Object.defineProperty(big, 'size', { value: 11 * 1024 * 1024 });
		await expect(drafts.uploadAttachment(big)).rejects.toMatchObject({ code: 'PAYLOAD_TOO_LARGE' });
	});

	it('sends through the outbox, can undo, then delivers to Sent', async () => {
		const drafts = new MockDraftRepository(ctx);
		const mail = new MockMailRepository(ctx);
		const simulator = new MockMailSimulator(ctx);
		await drafts.save(draft());

		const sent = await drafts.send({ draft: draft() });
		expect(Date.parse(sent.sendAt)).toBe(START + SEND_DELAY_MS);
		expect((await drafts.list()).map((d) => d.id)).not.toContain('u1-dnew');
		const outbox = (await mail.list({ mailbox: 'outbox' })).items;
		expect(outbox.map((t) => t.id)).toEqual([sent.threadId]);
		expect((await mail.get(sent.threadId)).messages[0]?.bodyText).toBe('Hi Ada');

		// Undo inside the window brings the draft back and removes the thread.
		const restored = await drafts.cancelSend(sent.messageId);
		expect(restored).toMatchObject({ subject: 'Hello', bodyHtml: '<p>Hi <b>Ada</b></p>' });
		await expect(mail.get(sent.threadId)).rejects.toMatchObject({ code: 'NOT_FOUND' });

		const again = await drafts.send({ draft: restored });
		now = START + SEND_DELAY_MS;
		await simulator.tick();
		const thread = await mail.get(again.threadId);
		expect(thread.mailboxes).toEqual(['sent']);
		expect(thread.messages[0]).toMatchObject({ status: 'sent', sendAt: null });
		await expect(drafts.cancelSend(again.messageId)).rejects.toMatchObject({ code: 'CONFLICT' });
	});

	it('schedules mail and replies into an existing thread', async () => {
		const drafts = new MockDraftRepository(ctx);
		const mail = new MockMailRepository(ctx);
		const sendAt = new Date(START + 86_400_000).toISOString();
		const scheduled = await drafts.send({ draft: draft(), sendAt });
		expect((await mail.get(scheduled.threadId)).mailboxes).toEqual(['scheduled']);
		expect((await mail.counts()).mailboxes.scheduled).toBe(3);

		const inbox = (await mail.list({ mailbox: 'inbox' })).items[0];
		const before = await mail.get(inbox?.id ?? '');
		const reply = await drafts.send({
			draft: draft({ id: 'u1-dreply', mode: 'reply', threadId: before.id, inReplyTo: 'x' })
		});
		expect(reply.threadId).toBe(before.id);
		const after = await mail.get(before.id);
		expect(after.messageCount).toBe(before.messageCount + 1);
		expect(after.mailboxes).toEqual(['inbox', 'outbox']);

		await expect(drafts.send({ draft: draft({ to: [] }) })).rejects.toMatchObject({
			code: 'VALIDATION_FAILED'
		});
	});
});

describe('MockMailSimulator', () => {
	it('drops new mail in the inbox and announces it', async () => {
		ctx.userId = 'u1';
		const events: ServerEvent[] = [];
		ctx.subscribe((event) => events.push(event));
		const summary = await new MockMailSimulator(ctx, () => 0).arrive();
		expect(summary).toMatchObject({ mailboxes: ['inbox'], isUnread: true, messageCount: 1 });
		expect(events.map((e) => e.type)).toEqual(['mail.new', 'counts']);
		const top = (await new MockMailRepository(ctx).list({ mailbox: 'inbox' }, { limit: 1 })).items;
		expect(top[0]?.id).toBe(summary?.id);
	});

	it('wakes due snoozes on the next tick, also after a reload', async () => {
		ctx.userId = 'u1';
		const mail = new MockMailRepository(ctx);
		const [thread] = (await mail.list({ mailbox: 'inbox' }, { limit: 1 })).items;
		const id = thread?.id ?? '';
		await mail.apply([id], { op: 'markRead' });
		await mail.apply([id], { op: 'snooze', until: new Date(START + 3_600_000).toISOString() });
		const events: ServerEvent[] = [];
		ctx.subscribe((event) => events.push(event));
		const woke = () => events.flatMap((e) => (e.type === 'snooze.woke' ? e.summaries : []));

		const simulator = new MockMailSimulator(ctx, () => 0.5);
		await simulator.tick();
		expect(woke().map((t) => t.id)).not.toContain(id);

		// A new simulator, as after a reload, catches up once the time has passed.
		now = START + 3_600_000;
		await new MockMailSimulator(ctx, () => 0.5).tick();
		expect(woke().find((t) => t.id === id)).toMatchObject({ snoozedUntil: null, isUnread: true });
		expect(events.at(-1)?.type).toBe('counts');
		expect(await mail.get(id)).toMatchObject({ mailboxes: ['inbox'], snoozedUntil: null });
		expect((await mail.list({ mailbox: 'snoozed' })).items.map((t) => t.id)).not.toContain(id);
	});

	it('ticks on a timer, does nothing signed out, and stops', async () => {
		vi.useFakeTimers();
		const simulator = new MockMailSimulator(ctx, () => 0.5);
		const tick = vi.spyOn(simulator, 'tick');
		simulator.start();
		await vi.advanceTimersByTimeAsync(TICK_MS * 3);
		expect(tick).toHaveBeenCalledTimes(3);
		expect(await simulator.arrive()).toBeNull();
		simulator.stop();
		await vi.advanceTimersByTimeAsync(TICK_MS * 3);
		expect(tick).toHaveBeenCalledTimes(3);
		expect(ARRIVAL_MEAN_MS).toBeGreaterThan(TICK_MS);
	});
});
