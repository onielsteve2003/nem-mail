import { describe, expect, it } from 'vitest';
import { highlightParts } from './highlight.js';

describe('highlightParts', () => {
	it('marks every match ignoring case and keeps the original text', () => {
		expect(highlightParts('Budget and budget', ['BUDGET'])).toEqual([
			{ text: 'Budget', match: true },
			{ text: ' and ', match: false },
			{ text: 'budget', match: true }
		]);
	});

	it('merges overlapping terms and phrases into one run', () => {
		expect(highlightParts('q4 plan review', ['q4 plan', 'plan review'])).toEqual([
			{ text: 'q4 plan review', match: true }
		]);
	});

	it('returns the text unmarked with no terms or no match', () => {
		expect(highlightParts('hello', [])).toEqual([{ text: 'hello', match: false }]);
		expect(highlightParts('hello', ['  ', 'zzz'])).toEqual([{ text: 'hello', match: false }]);
		expect(highlightParts('', ['a'])).toEqual([{ text: '', match: false }]);
	});
});
