import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	DURATIONS,
	REDUCED_MOTION_QUERY,
	SPRINGS,
	collapse,
	fadeScale,
	morph,
	prefersReducedMotion,
	sheetIn,
	slideStack,
	springPreset,
	tweenPreset
} from './index.js';

function setReducedMotion(isReduced: boolean) {
	vi.stubGlobal(
		'matchMedia',
		vi.fn((query: string) => ({ matches: isReduced && query === REDUCED_MOTION_QUERY }))
	);
}

const node = document.createElement('div');

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('prefersReducedMotion', () => {
	it('is false when matchMedia is unavailable', () => {
		vi.stubGlobal('matchMedia', undefined);
		expect(prefersReducedMotion()).toBe(false);
	});

	it('follows the media query', () => {
		setReducedMotion(true);
		expect(prefersReducedMotion()).toBe(true);
		setReducedMotion(false);
		expect(prefersReducedMotion()).toBe(false);
	});
});

describe('presets', () => {
	it('mirror the duration tokens', () => {
		const tokens = readFileSync(join(import.meta.dirname, '../styles/tokens.css'), 'utf8');
		for (const [name, ms] of Object.entries(DURATIONS)) {
			expect(tokens).toContain(`--nm-duration-${name}: ${ms}ms;`);
		}
	});

	it('animate normally', () => {
		setReducedMotion(false);
		expect(springPreset('snappy')).toEqual(SPRINGS.snappy);
		expect(tweenPreset('base').duration).toBe(DURATIONS.base);
	});

	it('snap to the target under reduced motion', () => {
		setReducedMotion(true);
		expect(springPreset('bouncy')).toEqual({ stiffness: 1, damping: 1 });
		expect(tweenPreset('slow').duration).toBe(0);
	});
});

describe('transitions', () => {
	const transitions = { sheetIn, fadeScale, slideStack, collapse, morph };

	it.each(Object.entries(transitions))('%s finishes at once under reduced motion', (_, fn) => {
		setReducedMotion(true);
		expect(fn(node)).toEqual({ duration: 0 });
	});

	it('sheetIn travels from below to its resting place', () => {
		setReducedMotion(false);
		const { css, duration } = sheetIn(node);
		expect(duration).toBe(DURATIONS.slow);
		expect(css?.(0, 1)).toBe('transform: translateY(100%);');
		expect(css?.(1, 0)).toBe('transform: translateY(0%);');
	});

	it('fadeScale fades and grows from the start scale', () => {
		setReducedMotion(false);
		const { css } = fadeScale(node, { start: 0.9 });
		expect(css?.(0, 1)).toBe('opacity: 0; transform: scale(0.9);');
		expect(css?.(1, 0)).toBe('opacity: 1; transform: scale(1);');
	});

	it('slideStack enters from the side given by direction', () => {
		setReducedMotion(false);
		expect(slideStack(node).css?.(0, 1)).toContain('translateX(30%)');
		expect(slideStack(node, { direction: -1, distance: 50 }).css?.(0, 1)).toContain(
			'translateX(-50%)'
		);
	});

	it('morph grows out of the origin rect, or slides up without one', () => {
		setReducedMotion(false);
		const surface = document.createElement('div');
		surface.getBoundingClientRect = () =>
			({ top: 0, left: 0, right: 400, bottom: 800, width: 400, height: 800 }) as DOMRect;
		const origin = { top: 720, left: 320, right: 376, bottom: 776, width: 56, height: 56 };
		const { css } = morph(surface, { origin });
		expect(css?.(0, 1)).toBe(
			'opacity: 0; transform: translate(-24px, -24px); clip-path: inset(744px 0px 0px 344px round 28px);'
		);
		expect(css?.(1, 0)).toContain(
			'translate(0px, 0px); clip-path: inset(0px 0px 0px 0px round 0px)'
		);
		expect(morph(surface).css?.(0, 1)).toBe('transform: translateY(100%);');
	});

	it('collapse shrinks height and padding to zero', () => {
		setReducedMotion(false);
		const row = document.createElement('div');
		row.style.height = '72px';
		row.style.paddingTop = '8px';
		const { css } = collapse(row);
		expect(css?.(1, 0)).toContain('height: 72px; padding-top: 8px;');
		expect(css?.(0, 1)).toContain('opacity: 0; height: 0px; padding-top: 0px;');
	});
});
