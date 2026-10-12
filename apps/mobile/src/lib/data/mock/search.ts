import { SearchQuerySchema, type Page, type SearchQuery, type ThreadSummary } from '@nem/shared';
import type { SearchRepository } from '../repositories.js';
import { validate, type MockContext } from './context.js';
import { stripOwner } from './db.js';
import { paginate } from './paginate.js';
import { buildIndex, hitKey, searchIndex } from './search-index.js';

/**
 * Full-text search over the account's mail (FR-7.1). The index is rebuilt per
 * query: a few hundred threads index in milliseconds, and it is never stale
 * after a mutation. `semantic` is ignored until on-device embeddings (M10).
 */
export class MockSearchRepository implements SearchRepository {
	readonly #ctx: MockContext;

	constructor(ctx: MockContext) {
		this.#ctx = ctx;
	}

	search(query: SearchQuery): Promise<Page<ThreadSummary>> {
		return this.#ctx.authed(async (db, userId) => {
			const { q, cursor, limit } = validate(SearchQuerySchema, query);
			const [threads, labels] = await Promise.all([
				db.getAllFromIndex('threads', 'byOwner', userId),
				db.getAllFromIndex('labels', 'byOwner', userId)
			]);
			const index = buildIndex(threads.map((t) => stripOwner(t)));
			const hits = searchIndex(
				index,
				q,
				labels.map((l) => stripOwner(l))
			);
			const page = paginate(hits, { cursor, limit }, hitKey);
			return { items: page.items.map((hit) => hit.summary), nextCursor: page.nextCursor };
		});
	}
}
