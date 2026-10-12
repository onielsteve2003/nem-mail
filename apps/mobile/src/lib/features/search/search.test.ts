import type { ThreadSummary } from '@nem/shared';
import { describe, expect, it } from 'vitest';
import { RECENT_LIMIT, addRecent, loadRecent, recentKey, saveRecent } from './recent.js';
import {
	DATE_PRESETS,
	activePreset,
	daysAgo,
	filterClauses,
	presetClause,
	setFilter,
	toggleClause
} from './filters.js';
import { searchUrl } from './search-url.js';
import { fromQuery, subjectQuery, subjectSuggestions } from './suggestions.js';

function memoryStorage() {
	const data = new Map<string, string>();
	return {
		getItem: (k: string) => data.get(k) ?? null,
		setItem: (k: string, v: string) => void data.set(k, v),
		removeItem: (k: string) => void data.delete(k),
		data
	};
}

describe('recent searches', () => {
	it('puts the newest first, drops repeats ignoring case and keeps the limit', () => {
		let list: string[] = [];
		for (let i = 0; i < RECENT_LIMIT + 2; i++) list = addRecent(list, `q${i}`);
		expect(list).toHaveLength(RECENT_LIMIT);
		expect(list[0]).toBe(`q${RECENT_LIMIT + 1}`);
		expect(addRecent(['Budget', 'x'], '  budget ')).toEqual(['budget', 'x']);
		expect(addRecent(['x'], '   ')).toEqual(['x']);
	});

	it('saves per account and survives bad or blocked storage', () => {
		const storage = memoryStorage();
		saveRecent(storage, 'u1', ['a', 'b']);
		expect(loadRecent(storage, 'u1')).toEqual(['a', 'b']);
		expect(loadRecent(storage, 'u2')).toEqual([]);
		saveRecent(storage, 'u1', []);
		expect(storage.data.has(recentKey('u1'))).toBe(false);

		storage.setItem(recentKey('u1'), '{not json');
		expect(loadRecent(storage, 'u1')).toEqual([]);
		storage.setItem(recentKey('u1'), JSON.stringify(['ok', 3]));
		expect(loadRecent(storage, 'u1')).toEqual(['ok']);

		const blocked = {
			getItem: () => {
				throw new Error('blocked');
			},
			setItem: () => {
				throw new Error('blocked');
			},
			removeItem: () => {}
		};
		expect(loadRecent(blocked, 'u1')).toEqual([]);
		expect(() => saveRecent(blocked, 'u1', ['a'])).not.toThrow();
		expect(loadRecent(undefined, 'u1')).toEqual([]);
	});
});

describe('suggestions', () => {
	const thread = (subject: string) => ({ subject }) as ThreadSummary;

	it('matches loaded subjects once each, up to the limit', () => {
		const threads = ['Budget Q3', 'budget q3', 'Team lunch', 'Budget review', 'Old budget', ''].map(
			thread
		);
		expect(subjectSuggestions(threads, 'BUDGET', 2)).toEqual(['Budget Q3', 'Budget review']);
		expect(subjectSuggestions(threads, ' ')).toEqual([]);
	});

	it('builds operator queries for tapped suggestions', () => {
		expect(fromQuery('ada@example.com')).toBe('from:ada@example.com');
		expect(subjectQuery('Team lunch')).toBe('subject:"Team lunch"');
	});
});

describe('searchUrl', () => {
	it('puts the query in ?q= and drops it when empty', () => {
		const url = searchUrl({ href: 'https://x.example/search?q=old' }, 'from:ada "big plans"');
		expect(url.searchParams.get('q')).toBe('from:ada "big plans"');
		expect(searchUrl(url, '').search).toBe('');
	});
});

describe('filter chips', () => {
	const now = new Date(2026, 9, 12, 15, 0);

	it('reads and replaces only the operators the chip owns', () => {
		const q = 'budget from:ada@x.io -from:bob@x.io';
		expect(filterClauses(q, 'from').map((c) => c.value)).toEqual(['ada@x.io']);
		expect(setFilter(q, 'from', [{ kind: 'from', value: 'cy@x.io', negated: false }])).toBe(
			'budget -from:bob@x.io from:cy@x.io'
		);
		expect(setFilter(q, 'from', [])).toBe('budget -from:bob@x.io');
		expect(filterClauses('is:read', 'unread')).toEqual([]);
	});

	it('toggles has:attachment and is:unread', () => {
		const on = setFilter('invoice', 'attachment', [toggleClause('attachment')]);
		expect(on).toBe('invoice has:attachment');
		expect(setFilter(on, 'unread', [toggleClause('unread')])).toBe(
			'invoice has:attachment is:unread'
		);
		expect(setFilter(on, 'attachment', [])).toBe('invoice');
	});

	it('writes date presets relative to today and recognizes them back', () => {
		expect(daysAgo(7, now)).toBe('2026-10-05');
		const older = DATE_PRESETS.find((p) => p.id === 'older-year')!;
		const q = setFilter('trip after:2020-01-01', 'date', [presetClause(older, now)]);
		expect(q).toBe('trip before:2025-10-12');
		expect(activePreset(q, now)?.id).toBe('older-year');
		expect(activePreset('after:2020-01-01', now)).toBeUndefined();
	});

	it('quotes label names with spaces', () => {
		expect(
			setFilter('', 'label', [{ kind: 'label', value: 'work/q4 plans', negated: false }])
		).toBe('label:"work/q4 plans"');
	});
});
