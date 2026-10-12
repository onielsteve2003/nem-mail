import { describe, expect, it } from 'vitest';
import { formatQuery, parseQuery, parseQueryDate, queryTerms } from './query-parser';

describe('parseQuery', () => {
	it('splits words, lowercases them and ignores extra spaces', () => {
		expect(parseQuery('  Budget   Review ').clauses).toEqual([
			{ kind: 'text', value: 'budget', phrase: false, negated: false },
			{ kind: 'text', value: 'review', phrase: false, negated: false }
		]);
		expect(parseQuery('   ').clauses).toEqual([]);
	});

	it('keeps quoted phrases together, closing an unfinished quote at the end', () => {
		expect(parseQuery('"quarterly  plan" x "open end').clauses).toEqual([
			{ kind: 'text', value: 'quarterly plan', phrase: true, negated: false },
			{ kind: 'text', value: 'x', phrase: false, negated: false },
			{ kind: 'text', value: 'open end', phrase: true, negated: false }
		]);
	});

	it('reads every FR-7.2 operator, with quoted values', () => {
		const q = parseQuery(
			'from:Ada@Example.com to:grace subject:"big plans" has:attachment is:unread is:starred label:Work before:2026/3/7 after:2025-12-31'
		);
		expect(q.clauses).toEqual([
			{ kind: 'from', value: 'ada@example.com', negated: false },
			{ kind: 'to', value: 'grace', negated: false },
			{ kind: 'subject', value: 'big plans', negated: false },
			{ kind: 'has', value: 'attachment', negated: false },
			{ kind: 'is', value: 'unread', negated: false },
			{ kind: 'is', value: 'starred', negated: false },
			{ kind: 'label', value: 'work', negated: false },
			{ kind: 'before', value: '2026-03-07', negated: false },
			{ kind: 'after', value: '2025-12-31', negated: false }
		]);
	});

	it('negates words, phrases and operators with a leading dash', () => {
		expect(parseQuery('-spam -"daily digest" -from:bot is:read -').clauses).toEqual([
			{ kind: 'text', value: 'spam', phrase: false, negated: true },
			{ kind: 'text', value: 'daily digest', phrase: true, negated: true },
			{ kind: 'from', value: 'bot', negated: true },
			{ kind: 'is', value: 'read', negated: false },
			{ kind: 'text', value: '-', phrase: false, negated: false }
		]);
	});

	it('treats unknown operators, bad values and empty values as text', () => {
		expect(parseQuery('foo:bar has:pdf is:maybe before:2026-02-30 from:').clauses).toEqual([
			{ kind: 'text', value: 'foo:bar', phrase: false, negated: false },
			{ kind: 'text', value: 'has:pdf', phrase: false, negated: false },
			{ kind: 'text', value: 'is:maybe', phrase: false, negated: false },
			{ kind: 'text', value: 'before:2026-02-30', phrase: false, negated: false },
			{ kind: 'text', value: 'from:', phrase: false, negated: false }
		]);
	});
});

describe('parseQueryDate', () => {
	it('normalizes real dates and rejects others', () => {
		expect(parseQueryDate('2026/1/5')).toBe('2026-01-05');
		expect(parseQueryDate('2024-02-29')).toBe('2024-02-29');
		expect(parseQueryDate('2025-02-29')).toBeNull();
		expect(parseQueryDate('yesterday')).toBeNull();
	});
});

describe('formatQuery', () => {
	it('round-trips through parseQuery', () => {
		const text = '-from:ada subject:"big plans" "exact words" budget is:unread after:2026-01-01';
		const parsed = parseQuery(text);
		expect(formatQuery(parsed)).toBe(text);
		expect(parseQuery(formatQuery(parsed))).toEqual(parsed);
	});
});

describe('queryTerms', () => {
	it('returns positive words, phrases and subject values', () => {
		expect(queryTerms(parseQuery('budget -spam "big plans" subject:launch from:ada'))).toEqual([
			'budget',
			'big plans',
			'launch'
		]);
	});
});
