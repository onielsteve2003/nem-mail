import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AuroraBackground from './AuroraBackground.svelte';

function setTabHidden(hidden: boolean) {
	Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
	document.dispatchEvent(new Event('visibilitychange'));
}

describe('AuroraBackground', () => {
	afterEach(() => {
		setTabHidden(false);
		vi.unstubAllGlobals();
	});

	it('is decorative and fixed by default', () => {
		const { container } = render(AuroraBackground);
		const aurora = container.querySelector('.aurora');

		expect(aurora).toHaveAttribute('aria-hidden', 'true');
		expect(aurora).toHaveClass('aurora--fixed');
		expect(aurora?.querySelectorAll('.blob')).toHaveLength(4);
	});

	it('pauses while the tab is hidden and resumes when it returns', async () => {
		const { container } = render(AuroraBackground);
		const aurora = container.querySelector('.aurora');
		expect(aurora).toHaveAttribute('data-paused', 'false');

		setTabHidden(true);
		await vi.waitFor(() => expect(aurora).toHaveAttribute('data-paused', 'true'));

		setTabHidden(false);
		await vi.waitFor(() => expect(aurora).toHaveAttribute('data-paused', 'false'));
	});

	it('pauses while scrolled out of view', async () => {
		let notify: IntersectionObserverCallback = () => {};
		vi.stubGlobal(
			'IntersectionObserver',
			class {
				constructor(callback: IntersectionObserverCallback) {
					notify = callback;
				}
				observe() {}
				disconnect() {}
			}
		);
		const { container } = render(AuroraBackground, { position: 'absolute' });
		const aurora = container.querySelector('.aurora');

		notify([{ isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver);
		await vi.waitFor(() => expect(aurora).toHaveAttribute('data-paused', 'true'));
	});

	it('stops the animation under reduced motion', () => {
		// Read from disk: the compiled component's CSS is not exposed in jsdom.
		const source = readFileSync(join(import.meta.dirname, 'AuroraBackground.svelte'), 'utf8');
		const reduced = source.slice(source.indexOf('@media (prefers-reduced-motion: reduce)'));

		expect(reduced).toMatch(/\.blob \{\s*animation: none;/);
	});

	it('stops the animation in low-power mode', () => {
		const source = readFileSync(join(import.meta.dirname, 'AuroraBackground.svelte'), 'utf8');

		expect(source).toMatch(
			/:global\(:root\[data-low-power='true'\]\) \.blob \{\s*animation: none;/
		);
	});
});
