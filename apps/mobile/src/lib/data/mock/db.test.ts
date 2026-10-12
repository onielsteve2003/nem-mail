import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import {
	DB_VERSION,
	getMeta,
	openMockDb,
	resetToSeed,
	seedIfEmpty,
	stripOwner,
	type MockDb
} from './db.js';

const NOW = new Date('2026-10-11T09:00:00.000Z');
let db: MockDb | undefined;
let n = 0;

async function freshDb(): Promise<MockDb> {
	db = await openMockDb(`test-${++n}`);
	return db;
}

afterEach(() => db?.close());

describe('mock IndexedDB', () => {
	it('creates every store at the current version', async () => {
		const db = await freshDb();
		expect(db.version).toBe(DB_VERSION);
		expect([...db.objectStoreNames].sort()).toEqual([
			'blobs',
			'contacts',
			'drafts',
			'labels',
			'meta',
			'settings',
			'threads',
			'users'
		]);
	});

	it('seeds on first run only', async () => {
		const db = await freshDb();
		expect(await seedIfEmpty(db, { now: NOW })).toBe(true);
		expect(await getMeta(db, 'seed')).toEqual({
			seed: 'nem-mail-demo-2',
			seededAt: NOW.toISOString()
		});
		expect(await db.count('users')).toBe(2);
		expect(await db.countFromIndex('threads', 'byOwner', 'u1')).toBeGreaterThan(300);
		expect(await db.countFromIndex('threads', 'byOwner', 'u2')).toBe(40);
		expect(await db.get('settings', 'u1')).toMatchObject({ ownerId: 'u1' });

		// A user change survives the next app start.
		await db.delete('threads', 'u2-t1');
		expect(await seedIfEmpty(db, { now: NOW })).toBe(false);
		expect(await db.get('threads', 'u2-t1')).toBeUndefined();

		// A changed demo seed replaces the old data once.
		expect(await seedIfEmpty(db, { now: NOW, seed: 'next' })).toBe(true);
		expect(await getMeta(db, 'seed')).toMatchObject({ seed: 'next' });
	});

	it('resetToSeed restores the seed and drops user data', async () => {
		const db = await freshDb();
		await seedIfEmpty(db, { now: NOW });
		const before = await db.count('threads');
		await db.delete('threads', 'u2-t1');
		await db.put('blobs', new Blob(['x']), 'upload-1');

		await resetToSeed(db, { now: NOW });
		expect(await db.count('threads')).toBe(before);
		expect(await db.get('threads', 'u2-t1')).toBeDefined();
		expect(await db.count('blobs')).toBe(0);
	});

	it('keeps data across reopening', async () => {
		const first = await freshDb();
		await seedIfEmpty(first, { now: NOW });
		first.close();
		db = await openMockDb(`test-${n}`);
		expect(await getMeta(db, 'seed')).toBeDefined();
		expect(await seedIfEmpty(db)).toBe(false);
	});

	it('stripOwner removes only the storage field', () => {
		expect(stripOwner({ id: 'a', ownerId: 'u1', name: 'x' })).toEqual({ id: 'a', name: 'x' });
	});
});
