import type { ThreadSummary } from '@nem/shared';
import { describe, expect, it } from 'vitest';
import { BUNDLED_CATEGORIES, bundleSenders, newCountLabel } from './categories.js';

const thread = (name: string, isUnread = true) =>
	({ isUnread, participants: [{ email: `${name}@x.io`, name }] }) as ThreadSummary;

describe('categories', () => {
	it('bundles every tab but Primary', () => {
		expect(BUNDLED_CATEGORIES).toEqual(['promotions', 'social', 'updates', 'forums']);
	});

	it('names unread senders once each, up to three', () => {
		const threads = [
			thread('Shop'),
			thread('Ada', false),
			thread('Shop'),
			thread('Bo'),
			thread('Cy'),
			thread('Di')
		];
		expect(bundleSenders(threads)).toBe('Shop, Bo, Cy');
		expect(bundleSenders([thread('Ada', false)])).toBe('');
	});

	it('labels new counts', () => {
		expect(newCountLabel(3)).toBe('3 new');
		expect(newCountLabel(120)).toBe('99+ new');
	});
});
