import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { MockContext } from './context.js';
import { openMockDb, seedIfEmpty, type MockDb } from './db.js';
import { MockSearchRepository } from './search.js';

const NOW = Date.parse('2026-10-11T09:00:00.000Z');
let n = 0;
let db: MockDb;
let search: MockSearchRepository;

beforeEach(async () => {
	db = await openMockDb(`search-${++n}`);
	await seedIfEmpty(db, { now: new Date(NOW) });
	const ctx = new MockContext({
		db: async () => db,
		now: () => NOW,
		latency: { min: 0, max: 0 },
		userId: 'u1'
	});
	search = new MockSearchRepository(ctx);
});

describe('MockSearchRepository', () => {
	it('pages through ranked results without gaps or repeats', async () => {
		const all = await search.search({ q: 'is:read', limit: 100 });
		const seen: string[] = [];
		let cursor: string | undefined;
		do {
			const page = await search.search({ q: 'is:read', cursor, limit: 40 });
			seen.push(...page.items.map((t) => t.id));
			cursor = page.nextCursor ?? undefined;
		} while (cursor);
		expect(seen.slice(0, all.items.length)).toEqual(all.items.map((t) => t.id));
		expect(seen.length).toBeGreaterThan(all.items.length);
		expect(new Set(seen).size).toBe(seen.length);
	});

	it('finds seed mail by a word from its subject and only the signed-in account', async () => {
		const [thread] = await db.getAllFromIndex('threads', 'byOwner', 'u1');
		const word = thread?.subject.split(/\s+/).find((w) => w.length > 4) ?? '';
		const { items } = await search.search({ q: word });
		expect(items.length).toBeGreaterThan(0);
		const owners = await Promise.all(items.map((t) => db.get('threads', t.id)));
		expect(owners.every((t) => t?.ownerId === 'u1')).toBe(true);
	});

	it('rejects an empty query', async () => {
		await expect(search.search({ q: '  ' })).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
	});
});
