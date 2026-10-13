import { describe, expect, it } from 'vitest';
import { displayMode } from './display-mode.js';

const media = (matching: string[]) => (query: string) => ({ matches: matching.includes(query) });

describe('displayMode', () => {
	it('is native inside the Capacitor app', () => {
		expect(displayMode({ isNative: true, matchMedia: media([]), isIosStandalone: false })).toBe(
			'native'
		);
	});

	it('is standalone when installed, by the display-mode query or the iOS flag', () => {
		const installed = media(['(display-mode: standalone)']);
		expect(displayMode({ isNative: false, matchMedia: installed, isIosStandalone: false })).toBe(
			'standalone'
		);
		expect(displayMode({ isNative: false, matchMedia: null, isIosStandalone: true })).toBe(
			'standalone'
		);
	});

	it('is browser in a normal tab', () => {
		expect(displayMode({ isNative: false, matchMedia: media([]), isIosStandalone: false })).toBe(
			'browser'
		);
	});
});
