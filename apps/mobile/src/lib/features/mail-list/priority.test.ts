import type { ThreadSummary } from '@nem/shared';
import { describe, expect, it } from 'vitest';
import { priorityOrder } from './priority';

function thread(id: string, flags: Partial<ThreadSummary> = {}): ThreadSummary {
	return { id, isImportant: false, isStarred: false, isUnread: false, ...flags } as ThreadSummary;
}
const insight = (value: number) => ({
	value,
	confidence: 1,
	explanation: '',
	source: 'model' as const
});

describe('priorityOrder', () => {
	it('ranks by model score, keeping list order on a tie', () => {
		const rows = [thread('a'), thread('b'), thread('c')];
		const order = priorityOrder(rows, { a: insight(0.2), b: insight(0.9), c: insight(0.2) });
		expect(order.map((t) => t.id)).toEqual(['b', 'a', 'c']);
	});

	it('puts threads the user marked important first and falls back to flags', () => {
		const rows = [
			thread('a'),
			thread('b', { isStarred: true }),
			thread('c', { isImportant: true })
		];
		expect(priorityOrder(rows, { a: insight(0.95) }).map((t) => t.id)).toEqual(['c', 'a', 'b']);
		expect(priorityOrder(rows, {}).map((t) => t.id)).toEqual(['c', 'b', 'a']);
	});
});
