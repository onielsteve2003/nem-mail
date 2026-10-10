import { describe, expect, it } from 'vitest';
import { APP_NAME, APP_TAGLINE } from './app';

describe('app constants', () => {
	it('names the product', () => {
		expect(APP_NAME).toBe('Nem Mail');
	});

	it('has a non-empty tagline', () => {
		expect(APP_TAGLINE.trim().length).toBeGreaterThan(0);
	});
});
