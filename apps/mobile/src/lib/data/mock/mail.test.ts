import 'fake-indexeddb/auto';
import { AppError, type ServerEvent, type ThreadSummary } from '@nem/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { MockContext, readFailRate } from './context.js';
import { openMockDb, seedIfEmpty, type MockDb } from './db.js';
import { MockMailRepository } from './mail.js';

const NOW = Date.parse('2026-10-11T09:00:00.000Z');
let n = 0;
let db: MockDb;
let ctx: MockContext;
let mail: MockMailRepository;

beforeEach(async () => {
	db = await openMockDb(`mail-${++n}`);
	await seedIfEmpty(db, { now: new Date(NOW) });
	ctx = new MockContext({
		db: async () => db,
		now: () => NOW,
		latency: { min: 0, max: 0 },
		userId: 'u1'
	});
	mail = new MockMailRepository(ctx);
});

async function listAll(
	filter: Parameters<MockMailRepository['list']>[0]
): Promise<ThreadSummary[]> {
	const items: ThreadSummary[] = [];
	let cursor: string | undefined;
	do {
		const page = await mail.list(filter, { cursor, limit: 40 });
		items.push(...page.items);
		cursor = page.nextCursor ?? undefined;
	} while (cursor);
	return items;
}

describe('MockMailRepository.list', () => {
	it('pages through the inbox newest first without gaps or repeats', async () => {
		const first = await mail.list({ mailbox: 'inbox' }, { limit: 10 });
		expect(first.items).toHaveLength(10);
		expect(first.nextCursor).not.toBeNull();

		const all = await listAll({ mailbox: 'inbox' });
		expect(new Set(all.map((t) => t.id)).size).toBe(all.length);
		const dates = all.map((t) => t.lastMessageAt);
		expect(dates).toEqual([...dates].sort().reverse());
		for (const t of all) {
			expect(t.mailboxes).toContain('inbox');
			expect(t).not.toHaveProperty('messages');
			expect(t).not.toHaveProperty('ownerId');
			expect(t.snoozedUntil === null || Date.parse(t.snoozedUntil) <= NOW).toBe(true);
		}
	});

	it('keeps the next page correct when rows above the cursor are archived', async () => {
		const first = await mail.list({ mailbox: 'inbox' }, { limit: 5 });
		const expected = (await mail.list({ mailbox: 'inbox' }, { limit: 10 })).items.slice(5);
		await mail.apply(
			first.items.map((t) => t.id),
			{ op: 'archive' }
		);
		const next = await mail.list(
			{ mailbox: 'inbox' },
			{ cursor: first.nextCursor ?? '', limit: 5 }
		);
		expect(next.items.map((t) => t.id)).toEqual(expected.map((t) => t.id));
	});

	it('filters by inbox tab, label and flag views', async () => {
		const promotions = await listAll({ mailbox: 'inbox', category: 'promotions' });
		expect(promotions.length).toBeGreaterThan(0);
		expect(promotions.every((t) => t.category === 'promotions')).toBe(true);

		const labelled = await listAll({ labelId: 'u1-l1' });
		expect(labelled.length).toBeGreaterThan(0);
		expect(labelled.every((t) => t.labelIds.includes('u1-l1'))).toBe(true);

		const snoozed = await listAll({ mailbox: 'snoozed' });
		expect(snoozed).toHaveLength(4);
		expect(await listAll({ mailbox: 'trash' })).toHaveLength(8);
		expect(await listAll({ mailbox: 'scheduled' })).toHaveLength(2);

		const all = await listAll({ mailbox: 'all' });
		expect(all.some((t) => t.mailboxes.includes('spam') || t.mailboxes.includes('trash'))).toBe(
			false
		);
	});

	it('only shows the signed-in account', async () => {
		ctx.userId = 'u2';
		const all = await listAll({ mailbox: 'all' });
		expect(all).toHaveLength(40);
		expect(all.every((t) => t.id.startsWith('u2-'))).toBe(true);
	});

	it('rejects a bad cursor', async () => {
		await expect(mail.list({ mailbox: 'inbox' }, { cursor: '%%%' })).rejects.toMatchObject({
			code: 'BAD_REQUEST'
		});
	});
});

describe('MockMailRepository.get', () => {
	it('returns the thread with messages', async () => {
		const thread = await mail.get('u1-t1');
		expect(thread.messages.length).toBe(thread.messageCount);
		expect(thread).not.toHaveProperty('ownerId');
	});

	it("hides another account's thread", async () => {
		await expect(mail.get('u2-t1')).rejects.toMatchObject({ code: 'NOT_FOUND' });
		await expect(mail.get('nope')).rejects.toBeInstanceOf(AppError);
	});
});

describe('MockMailRepository.apply', () => {
	it('persists ops and reports only changed ids', async () => {
		const [row] = (await mail.list({ mailbox: 'inbox' }, { limit: 1 })).items;
		const id = row?.id ?? '';
		const result = await mail.apply([id, id, 'u2-t1', 'missing'], { op: 'star' });
		expect(result.updatedIds).toEqual(row?.isStarred ? [] : [id]);
		expect((await mail.get(id)).isStarred).toBe(true);
		expect((await mail.apply([id], { op: 'star' })).updatedIds).toEqual([]);

		await mail.apply([id], { op: 'trash' });
		const inTrash = (await mail.list({ mailbox: 'trash' }, { limit: 100 })).items;
		expect(inTrash.map((t) => t.id)).toContain(id);
		expect((await listAll({ mailbox: 'starred' })).map((t) => t.id)).not.toContain(id);
	});

	it('marks read and unread across messages', async () => {
		await mail.apply(['u1-t1'], { op: 'markRead' });
		let thread = await mail.get('u1-t1');
		expect(thread.isUnread).toBe(false);
		expect(thread.messages.every((m) => m.isRead)).toBe(true);
		await mail.apply(['u1-t1'], { op: 'markUnread' });
		thread = await mail.get('u1-t1');
		expect(thread.isUnread).toBe(true);
		expect(thread.messages.at(-1)?.isRead).toBe(false);
	});

	it('emits fresh counts after a change', async () => {
		const events: ServerEvent[] = [];
		const stop = mail.subscribe((event) => events.push(event));
		const unread = (await mail.list({ mailbox: 'inbox' })).items.find((t) => t.isUnread);
		const before = (await mail.counts()).mailboxes.inbox ?? 0;
		await mail.apply([unread?.id ?? ''], { op: 'markRead' });
		stop();
		expect(events).toEqual([{ type: 'counts', counts: expect.objectContaining({}) as unknown }]);
		const event = events[0];
		expect(event?.type === 'counts' && event.counts.mailboxes.inbox).toBe(before - 1);
	});
});

describe('MockMailRepository delete forever', () => {
	it('deletes only threads in Spam or Trash', async () => {
		const [binned, kept] = (await mail.list({ mailbox: 'inbox' })).items;
		await mail.apply([binned!.id], { op: 'trash' });
		const result = await mail.deleteForever([binned!.id, kept!.id]);
		expect(result.updatedIds).toEqual([binned!.id]);
		await expect(mail.get(binned!.id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
		await expect(mail.get(kept!.id)).resolves.toMatchObject({ id: kept!.id });
	});

	it('empties a mailbox and leaves the other one alone', async () => {
		const [a, b] = (await mail.list({ mailbox: 'inbox' })).items;
		await mail.apply([a!.id], { op: 'trash' });
		await mail.apply([b!.id], { op: 'spam' });
		const spamBefore = await listAll({ mailbox: 'spam' });
		await mail.empty('trash');
		expect(await listAll({ mailbox: 'trash' })).toEqual([]);
		expect(await listAll({ mailbox: 'spam' })).toHaveLength(spamBefore.length);
		expect((await mail.counts()).mailboxes.trash).toBe(0);
	});
});

describe('MockMailRepository.counts', () => {
	it('counts unread per mailbox, tab and label, and every draft', async () => {
		const counts = await mail.counts();
		const inbox = await listAll({ mailbox: 'inbox' });
		expect(counts.mailboxes.inbox).toBe(inbox.filter((t) => t.isUnread).length);
		expect(counts.mailboxes.drafts).toBe(3);
		expect(counts.mailboxes.scheduled).toBe(2);
		const tabs = Object.values(counts.categories).reduce((a, b) => a + b, 0);
		expect(tabs).toBe(counts.mailboxes.inbox);
		expect(Object.keys(counts.labels).every((id) => id.startsWith('u1-l'))).toBe(true);
	});
});

describe('MockMailRepository.getAttachment', () => {
	it('returns a placeholder for seed attachments and stored bytes for uploads', async () => {
		const withFile = (await listAll({ mailbox: 'all' })).find((t) => t.attachments.length > 0);
		const thread = await mail.get(withFile?.id ?? '');
		const attachment = thread.messages.flatMap((m) => m.attachments)[0];
		const blob = await mail.getAttachment(attachment?.id ?? '');
		// Seed images are drawn as SVG so thumbnails render; other files keep their type.
		expect(blob.type).toBe(
			attachment?.mime.startsWith('image/') ? 'image/svg+xml' : attachment?.mime
		);

		await db.put('blobs', new Blob(['hi'], { type: 'text/plain' }), 'upload-1');
		// fake-indexeddb clones jsdom Blobs into plain objects, so only check it came from the store.
		expect(await mail.getAttachment('upload-1')).toBeTruthy();
		await expect(mail.getAttachment('missing')).rejects.toMatchObject({ code: 'NOT_FOUND' });
	});
});

describe('simulated network', () => {
	it('fails before writing when error injection hits', async () => {
		ctx.failRate = 1;
		await expect(mail.apply(['u1-t1'], { op: 'trash' })).rejects.toMatchObject({
			code: 'NETWORK',
			retryable: true
		});
		ctx.failRate = 0;
		expect((await mail.get('u1-t1')).mailboxes).not.toContain('trash');
	});

	it('needs a signed-in user', async () => {
		ctx.userId = null;
		await expect(mail.counts()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
	});

	it('waits between the latency bounds', async () => {
		const slow = new MockContext({
			db: async () => db,
			latency: { min: 30, max: 30 },
			userId: 'u1'
		});
		const start = performance.now();
		await new MockMailRepository(slow).counts();
		expect(performance.now() - start).toBeGreaterThanOrEqual(25);
	});

	it('reads ?fail= from the query string', () => {
		expect(readFailRate('?fail=0.1')).toBe(0.1);
		expect(readFailRate('?fail=5')).toBe(1);
		expect(readFailRate('?fail=abc')).toBe(0);
		expect(readFailRate('')).toBe(0);
	});
});
