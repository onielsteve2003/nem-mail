import { describe, expect, it } from 'vitest';
import { placePopover, pointToRect, POPOVER_GAP, POPOVER_MARGIN } from './popover.js';

const viewport = { width: 400, height: 800 };
const panel = { width: 200, height: 150 };
const anchor = { top: 100, bottom: 140, left: 50, right: 150 };

describe('placePopover', () => {
	it('opens below, aligned to the anchor start, by default', () => {
		expect(placePopover(anchor, panel, viewport)).toEqual({
			top: 140 + POPOVER_GAP,
			left: 50,
			placement: 'bottom-start'
		});
	});

	it('aligns the panel end to the anchor end', () => {
		const right = { top: 100, bottom: 140, left: 300, right: 380 };
		expect(placePopover(right, panel, viewport, 'bottom-end').left).toBe(180);
	});

	it('flips above when there is no room below', () => {
		const low = { top: 700, bottom: 740, left: 50, right: 150 };
		const pos = placePopover(low, panel, viewport);
		expect(pos.placement).toBe('top-start');
		expect(pos.top).toBe(700 - POPOVER_GAP - 150);
	});

	it('flips below when there is no room above', () => {
		expect(placePopover(anchor, panel, viewport, 'top-start').placement).toBe('bottom-start');
	});

	it('keeps the panel inside the viewport horizontally', () => {
		const edge = { top: 100, bottom: 140, left: 350, right: 390 };
		expect(placePopover(edge, panel, viewport).left).toBe(400 - 200 - POPOVER_MARGIN);
		const leftEdge = { top: 100, bottom: 140, left: 0, right: 20 };
		expect(placePopover(leftEdge, panel, viewport, 'bottom-end').left).toBe(POPOVER_MARGIN);
	});

	it('places at a point for long-press menus', () => {
		const pos = placePopover(pointToRect({ x: 60, y: 300 }), panel, viewport);
		expect(pos).toEqual({ top: 300 + POPOVER_GAP, left: 60, placement: 'bottom-start' });
	});
});
