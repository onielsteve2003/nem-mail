import { ContactQuerySchema, type Contact, type ContactQuery } from '@nem/shared';
import type { ContactRepository } from '../repositories.js';
import { validate, type MockContext } from './context.js';
import { stripOwner } from './db.js';

export class MockContactRepository implements ContactRepository {
	readonly #ctx: MockContext;

	constructor(ctx: MockContext) {
		this.#ctx = ctx;
	}

	/** Name or email matches, ranked by frequency, then recency. An empty query lists top contacts. */
	search(query: ContactQuery): Promise<Contact[]> {
		return this.#ctx.authed(async (db, userId) => {
			const { q, limit } = validate(ContactQuerySchema, query);
			const needle = q.toLowerCase();
			return (await db.getAllFromIndex('contacts', 'byOwner', userId))
				.filter(
					(c) => c.email.includes(needle) || (c.name?.toLowerCase().includes(needle) ?? false)
				)
				.sort(
					(a, b) =>
						b.frequency - a.frequency ||
						(b.lastContactedAt ?? '').localeCompare(a.lastContactedAt ?? '')
				)
				.slice(0, limit)
				.map((c) => stripOwner(c));
		});
	}
}
