import { DEMO_EMAIL, DEMO_WORK_EMAIL } from './mock/auth.js';
import { openMockDb, seedIfEmpty, type MockDb } from './mock/db.js';
import { createRepositories } from './provider.js';
import type { Repositories } from './repositories.js';

export { DEMO_EMAIL, DEMO_WORK_EMAIL };

let count = 0;

/**
 * Test helper: mock repositories over a fresh seeded database with no latency,
 * so store tests need not import `data/mock` (which stays private to data/).
 * Needs `fake-indexeddb/auto` in the test file.
 */
export async function createTestRepositories(
	now: number
): Promise<{ repos: Repositories; db: MockDb }> {
	const db = await openMockDb(`test-${++count}-${now}`);
	await seedIfEmpty(db, { now: new Date(now) });
	const { repos } = createRepositories(
		{ dataSource: 'mock', apiUrl: '' },
		{ mock: { db: async () => db, now: () => now, latency: { min: 0, max: 0 } } }
	);
	return { repos, db };
}
