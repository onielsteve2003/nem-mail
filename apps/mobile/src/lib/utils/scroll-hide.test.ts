import { describe, expect, it } from 'vitest';
import { SCROLL_HIDE_INITIAL, nextScrollHide, type ScrollHideState } from './scroll-hide.js';

const scroll = (...ys: number[]): ScrollHideState => ys.reduce(nextScrollHide, SCROLL_HIDE_INITIAL);

describe('nextScrollHide', () => {
	it('hides on scroll down and shows on scroll up', () => {
		expect(scroll(100, 300).isVisible).toBe(false);
		expect(scroll(100, 300, 250).isVisible).toBe(true);
	});

	it('ignores small jitter', () => {
		expect(scroll(100, 300, 296).isVisible).toBe(false);
		expect(scroll(100, 300, 250, 254).isVisible).toBe(true);
	});

	it('always shows near the top', () => {
		expect(scroll(300, 40).isVisible).toBe(true);
		expect(scroll(10, 50).isVisible).toBe(true);
	});
});
