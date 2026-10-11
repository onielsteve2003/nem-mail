import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { THEME_STORAGE_KEY, parseThemePreference, resolveTheme } from './theme.js';

describe('parseThemePreference', () => {
	it.each(['system', 'dark', 'light'] as const)('keeps %s', (value) => {
		expect(parseThemePreference(value)).toBe(value);
	});

	it.each([null, undefined, '', 'sepia', 'DARK'])('falls back to system for %s', (value) => {
		expect(parseThemePreference(value)).toBe('system');
	});
});

describe('resolveTheme', () => {
	it('follows the OS when the preference is system', () => {
		expect(resolveTheme('system', true)).toBe('light');
		expect(resolveTheme('system', false)).toBe('dark');
	});

	it('lets an explicit choice override the OS', () => {
		expect(resolveTheme('dark', true)).toBe('dark');
		expect(resolveTheme('light', false)).toBe('light');
	});
});

describe('no-flash script in app.html', () => {
	const read = (path: string) =>
		readFileSync(join(import.meta.dirname, path), 'utf8').replaceAll('\r\n', '\n');
	const html = read('../../app.html');
	const tokens = read('../styles/tokens.css');

	/** --nm-color-bg as declared in the block that starts with `selector`. */
	function background(selector: string): string {
		const block = tokens.slice(tokens.indexOf(`${selector} {`));
		const value = /--nm-color-bg:\s*([^;]+);/.exec(block)?.[1];
		if (!value) throw new Error(`No --nm-color-bg in ${selector}`);
		return value.trim();
	}

	it('reads the same storage key as the store', () => {
		expect(html).toContain(`localStorage.getItem('${THEME_STORAGE_KEY}')`);
	});

	it('paints theme-color with each theme background token', () => {
		expect(html).toContain(
			`isLight ? '${background(":root[data-theme='light']")}' : '${background(':root')}'`
		);
		expect(html).toContain(`<meta name="theme-color" content="${background(':root')}" />`);
	});
});
