import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TICK_MS } from './mock/arrival.js';
import { DEMO_EMAIL } from './mock/auth.js';
import { openMockDb, seedIfEmpty } from './mock/db.js';
import { createRepositories } from './provider.js';

afterEach(() => vi.useRealTimers());

describe('createRepositories', () => {
	it('returns the HTTP repositories in api mode', async () => {
		const { repos, start } = createRepositories({
			dataSource: 'api',
			apiUrl: 'https://api.example'
		});
		// No token on the device yet, so nobody is signed in and no request is made.
		await expect(repos.auth.me()).resolves.toBeNull();
		expect(await repos.auth.listAccounts()).toEqual([]);
		start()();
	});

	it('wires the mock repositories to one shared session in mock mode', async () => {
		const db = await openMockDb('provider-1');
		await seedIfEmpty(db, { now: new Date() });
		const { repos } = createRepositories(
			{ dataSource: 'mock', apiUrl: '' },
			{ mock: { db: async () => db, latency: { min: 0, max: 0 } } }
		);
		await repos.auth.signIn({ email: DEMO_EMAIL, password: 'anything-goes' });
		const page = await repos.mail.list({ mailbox: 'inbox' }, { limit: 5 });
		expect(page.items).toHaveLength(5);
		expect((await repos.labels.list()).length).toBeGreaterThan(0);
		expect((await repos.search.search({ q: 'is:unread' })).items.length).toBeGreaterThan(0);
		db.close();
	});

	it('delivers one new inbox message on sync in mock mode', async () => {
		// 0 picks a new thread, not a reply (a reply to an unread thread leaves the count as is).
		const random = vi.spyOn(Math, 'random').mockReturnValue(0);
		const db = await openMockDb('provider-sync');
		await seedIfEmpty(db, { now: new Date() });
		const { repos, sync } = createRepositories(
			{ dataSource: 'mock', apiUrl: '' },
			{ mock: { db: async () => db, latency: { min: 0, max: 0 } } }
		);
		await repos.auth.signIn({ email: DEMO_EMAIL, password: 'anything-goes' });
		const before = (await repos.mail.counts()).mailboxes.inbox ?? 0;
		await sync();
		expect((await repos.mail.counts()).mailboxes.inbox).toBe(before + 1);
		db.close();
		random.mockRestore();
	});

	it('reads ?fail= into the simulated network', async () => {
		const db = await openMockDb('provider-2');
		const { repos } = createRepositories(
			{ dataSource: 'mock', apiUrl: '' },
			{ search: '?fail=1', mock: { db: async () => db, latency: { min: 0, max: 0 } } }
		);
		await expect(repos.auth.me()).rejects.toMatchObject({ code: 'NETWORK' });
		db.close();
	});

	it('starts and stops the mail simulator', async () => {
		vi.useFakeTimers();
		// The tick only needs to be seen; a database that never opens keeps it from doing work.
		const getDb = vi.fn(() => new Promise<never>(() => {}));
		const { start } = createRepositories(
			{ dataSource: 'mock', apiUrl: '' },
			{ mock: { db: getDb, latency: { min: 0, max: 0 }, userId: 'u1' } }
		);
		const stop = start();
		await vi.advanceTimersByTimeAsync(TICK_MS);
		expect(getDb).toHaveBeenCalledTimes(1);
		stop();
		await vi.advanceTimersByTimeAsync(TICK_MS * 3);
		expect(getDb).toHaveBeenCalledTimes(1);
	});
});
