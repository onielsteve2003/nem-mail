import { describe, expect, it } from 'vitest';
import { keyboardInset, watchKeyboard } from './keyboard.js';

describe('keyboardInset', () => {
	it('measures the part of the layout an overlaid keyboard covers', () => {
		expect(keyboardInset(844, 508, 0)).toBe(336);
		expect(keyboardInset(844, 508, 40)).toBe(296);
	});

	it('ignores small changes from browser toolbars', () => {
		expect(keyboardInset(844, 780, 0)).toBe(0);
		expect(keyboardInset(844, 844, 0)).toBe(0);
	});
});

describe('watchKeyboard', () => {
	it('tracks the visual viewport on the web and stops cleanly', () => {
		let onResize: (() => void) | undefined;
		const viewport = {
			height: 844,
			offsetTop: 0,
			addEventListener: (type: string, listener: () => void) => {
				if (type === 'resize') onResize = listener;
			},
			removeEventListener: () => (onResize = undefined)
		};
		const original = window.visualViewport;
		Object.defineProperty(window, 'visualViewport', { value: viewport, configurable: true });
		Object.defineProperty(window, 'innerHeight', { value: 844, configurable: true });
		const root = document.createElement('div');

		const stop = watchKeyboard(root);
		expect(root.dataset['keyboard']).toBe('closed');

		viewport.height = 500;
		onResize?.();
		expect(root.dataset['keyboard']).toBe('open');
		expect(root.style.getPropertyValue('--nm-keyboard-inset')).toBe('344px');

		stop();
		expect(onResize).toBeUndefined();
		Object.defineProperty(window, 'visualViewport', { value: original, configurable: true });
	});
});
