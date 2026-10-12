import { describe, expect, it } from 'vitest';
import { ROW_ESTIMATE_PX, rowEstimate, virtualRange } from './virtual.js';

const rows = (count: number, height = 100) => Array.from({ length: count }, () => height);

describe('virtualRange', () => {
	it('renders from the top when scrolled to the start', () => {
		expect(virtualRange(rows(1000), 0, 600, 200)).toEqual({
			start: 0,
			end: 8,
			before: 0,
			after: 99_200
		});
	});

	it('skips rows above the viewport and keeps the total height', () => {
		const range = virtualRange(rows(1000), 5000, 600, 200);
		expect(range).toMatchObject({ start: 48, end: 58, before: 4800 });
		expect(range.before + (range.end - range.start) * 100 + range.after).toBe(100_000);
	});

	it('handles mixed heights and the end of the list', () => {
		const heights = [50, 150, 100, 100];
		expect(virtualRange(heights, 350, 100, 0)).toEqual({ start: 3, end: 4, before: 300, after: 0 });
		expect(virtualRange(heights, 1000, 100, 0)).toEqual({
			start: 4,
			end: 4,
			before: 400,
			after: 0
		});
	});

	it('returns nothing for an empty list', () => {
		expect(virtualRange([], 0, 600)).toEqual({ start: 0, end: 0, before: 0, after: 0 });
	});
});

describe('rowEstimate', () => {
	it('averages measured rows and falls back to the estimate', () => {
		expect(rowEstimate([])).toBe(ROW_ESTIMATE_PX);
		expect(rowEstimate([60, 100])).toBe(80);
	});
});
