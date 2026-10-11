import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Read from disk: Vitest stubs CSS imports (even ?raw) to an empty string.
const css = readFileSync(join(import.meta.dirname, 'typography.css'), 'utf8');

const SCALE = [
	'display',
	'title-1',
	'title-2',
	'title-3',
	'body-lg',
	'body',
	'label',
	'caption',
	'micro'
] as const;

function token(name: string): string {
	const value = new RegExp(`${name}:\\s*([^;]+);`).exec(css)?.[1];
	if (value === undefined) throw new Error(`Missing ${name}`);
	return value.trim();
}

describe('typography', () => {
	it('loads the self-hosted variable fonts', () => {
		expect(css).toContain("@import '@fontsource-variable/space-grotesk/wght.css'");
		expect(css).toContain("@import '@fontsource-variable/inter/wght.css'");
		expect(token('--nm-font-display')).toMatch(/^'Space Grotesk Variable'/);
		expect(token('--nm-font-body')).toMatch(/^'Inter Variable'/);
	});

	it('sizes the scale in rem, largest to smallest', () => {
		const sizes = SCALE.map((step) => {
			const value = token(`--nm-text-${step}`);
			expect(value).toMatch(/^[\d.]+rem$/);
			return parseFloat(value);
		});
		expect(sizes).toEqual([...sizes].sort((a, b) => b - a));
	});

	it('has a utility class for every step', () => {
		for (const step of SCALE) expect(css).toContain(`.nm-text-${step} {`);
	});
});
