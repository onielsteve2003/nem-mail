import { describe, expect, it } from 'vitest';
import { resolveSnap, snapOffsets } from './sheet.js';

describe('snapOffsets', () => {
	it('is a single fully open position without snap points', () => {
		expect(snapOffsets([], 800)).toEqual([0]);
	});

	it('measures each point down from the tallest', () => {
		expect(snapOffsets([0.5, 0.9], 1000)).toEqual([400, 0]);
	});
});

describe('resolveSnap', () => {
	const offsets = [400, 0];
	const sheetHeight = 900;

	it('settles on the nearest snap point', () => {
		expect(resolveSnap({ position: 120, velocity: 0, offsets, sheetHeight })).toBe(1);
		expect(resolveSnap({ position: 300, velocity: 0, offsets, sheetHeight })).toBe(0);
	});

	it('follows a fling past the halfway mark', () => {
		expect(resolveSnap({ position: 150, velocity: 1.5, offsets, sheetHeight })).toBe(0);
	});

	it('dismisses when dragged well below the lowest point', () => {
		// Visible at the lowest point is 500px; 35% of that past 400 is 575.
		expect(resolveSnap({ position: 560, velocity: 0, offsets, sheetHeight })).toBe(0);
		expect(resolveSnap({ position: 590, velocity: 0, offsets, sheetHeight })).toBe(-1);
	});

	it('dismisses a content-sized sheet on a downward fling', () => {
		expect(resolveSnap({ position: 40, velocity: 2, offsets: [0], sheetHeight: 300 })).toBe(-1);
	});
});
