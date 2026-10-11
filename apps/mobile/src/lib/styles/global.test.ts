import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Read from disk: Vitest stubs CSS imports (even ?raw) to an empty string.
const read = (file: string) =>
	readFileSync(join(import.meta.dirname, file), 'utf8').replaceAll('\r\n', '\n');
const css = read('global.css');
const tokens = read('tokens.css');

describe('global styles', () => {
	it('exposes every safe-area inset as a token', () => {
		for (const side of ['top', 'right', 'bottom', 'left']) {
			expect(css).toContain(`--nm-safe-${side}: env(safe-area-inset-${side}, 0px);`);
		}
	});

	it('zeroes every duration token under reduced motion', () => {
		const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
		const durations = [...tokens.matchAll(/(--nm-duration-[\w-]+):/g)].map((m) => m[1]);
		expect(durations.length).toBeGreaterThan(0);
		for (const name of durations) expect(reduced).toContain(`${name}: 0ms;`);
	});

	it('shows a focus ring for keyboard focus', () => {
		expect(css).toMatch(/:focus-visible \{[^}]*box-shadow: var\(--nm-focus-ring\)/);
	});
});
