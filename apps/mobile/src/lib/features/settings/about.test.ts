import { describe, expect, it } from 'vitest';
import { MODELS } from '#lib/ai/registry.js';
import { THEME_STORAGE_KEY } from '#lib/utils/theme.js';
import pkg from '../../../../package.json';
import { isAppStorageKey, MODEL_CREDITS, PACKAGE_CREDITS } from './about.js';

describe('about credits', () => {
	it('credits every runtime dependency', () => {
		const credited = new Set(PACKAGE_CREDITS.map((credit) => credit.name));
		const missing = Object.keys(pkg.dependencies).filter(
			(name) => name !== '@nem/shared' && !credited.has(name)
		);
		expect(missing).toEqual([]);
	});

	it('credits every optional model with its license', () => {
		expect(MODEL_CREDITS).toHaveLength(MODELS.length);
		expect(MODEL_CREDITS.every((credit) => credit.license)).toBe(true);
	});

	it('clears only Nem Mail storage keys', () => {
		expect(isAppStorageKey(THEME_STORAGE_KEY)).toBe(true);
		expect(isAppStorageKey('nem-mail:recent-searches:u1')).toBe(true);
		expect(isAppStorageKey('other-app')).toBe(false);
	});
});
