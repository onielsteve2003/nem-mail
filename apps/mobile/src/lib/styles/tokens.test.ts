import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Read from disk: Vitest stubs CSS imports (even ?raw) to an empty string.
const css = readFileSync(join(import.meta.dirname, 'tokens.css'), 'utf8').replaceAll('\r\n', '\n');

const AA_TEXT = 4.5;

/** Reads the `--nm-*` custom properties declared in the first block that matches `selector`. */
function readBlock(selector: string): Map<string, string> {
	const start = css.indexOf(`${selector} {`);
	if (start === -1) throw new Error(`No block for ${selector}`);
	const body = css.slice(start, css.indexOf('\n}', start));
	const tokens = new Map<string, string>();
	for (const { 1: name, 2: value } of body.matchAll(/(--nm-[\w-]+):\s*([^;]+);/g)) {
		if (name && value) tokens.set(name, value.trim());
	}
	return tokens;
}

/** Light inherits every token it does not override from the dark :root block. */
const dark = readBlock(':root');
const light = new Map([...dark, ...readBlock(":root[data-theme='light']")]);

function resolve(theme: Map<string, string>, name: string): string {
	const value = theme.get(name);
	if (value === undefined) throw new Error(`Missing token ${name}`);
	const ref = /^var\((--nm-[\w-]+)\)$/.exec(value)?.[1];
	return ref ? resolve(theme, ref) : value;
}

function luminance(hex: string): number {
	const match = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex);
	if (!match) throw new Error(`Expected a 6-digit hex color, got ${hex}`);
	const [r, g, b] = [match[1], match[2], match[3]].map((pair) => {
		const c = parseInt(pair ?? '', 16) / 255;
		return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
	}) as [number, number, number];
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2 contrast ratio between two 6-digit hex colors. */
function contrast(a: string, b: string): number {
	const [la, lb] = [luminance(a), luminance(b)];
	return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const SURFACES = ['--nm-color-bg', '--nm-color-surface-1', '--nm-color-surface-2'];
const TEXT_TOKENS = [
	'--nm-color-text',
	'--nm-color-text-muted',
	'--nm-color-text-subtle',
	'--nm-color-accent-text',
	'--nm-color-cyan-text',
	'--nm-color-lime-text',
	'--nm-color-coral-text',
	'--nm-color-amber-text',
	'--nm-color-success',
	'--nm-color-danger',
	'--nm-color-warning',
	'--nm-color-info'
];
const FILL_PAIRS = [
	['--nm-color-accent', '--nm-color-on-accent'],
	['--nm-color-accent-pressed', '--nm-color-on-accent'],
	['--nm-color-danger-fill', '--nm-color-on-danger']
];

describe.each([
	['dark', dark],
	['light', light]
])('%s theme tokens', (_name, theme) => {
	it.each(TEXT_TOKENS.flatMap((text) => SURFACES.map((surface) => [text, surface])))(
		'%s on %s passes AA',
		(text, surface) => {
			expect(contrast(resolve(theme, text), resolve(theme, surface))).toBeGreaterThanOrEqual(
				AA_TEXT
			);
		}
	);

	it.each(['--nm-color-text', '--nm-color-text-muted'])('%s on surface-3 passes AA', (text) => {
		expect(
			contrast(resolve(theme, text), resolve(theme, '--nm-color-surface-3'))
		).toBeGreaterThanOrEqual(AA_TEXT);
	});

	it.each(FILL_PAIRS)('%s with %s on top passes AA', (fill, on) => {
		expect(contrast(resolve(theme, fill), resolve(theme, on))).toBeGreaterThanOrEqual(AA_TEXT);
	});
});

describe('token scales', () => {
	it('keeps the z-index scale strictly increasing', () => {
		const order = [
			'base',
			'raised',
			'sticky',
			'fab',
			'drawer',
			'overlay',
			'sheet',
			'modal',
			'popover',
			'toast',
			'tooltip'
		].map((layer) => Number(resolve(dark, `--nm-z-${layer}`)));
		expect(order).toEqual([...order].sort((a, b) => a - b));
		expect(new Set(order).size).toBe(order.length);
	});

	it('uses only --nm- prefixed custom properties', () => {
		const declared = [...css.matchAll(/^\s*(--[\w-]+):/gm)].map((match) => match[1] ?? '');
		expect(declared.length).toBeGreaterThan(0);
		expect(declared.filter((name) => !name.startsWith('--nm-'))).toEqual([]);
	});
});
