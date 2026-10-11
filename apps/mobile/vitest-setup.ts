// Adds DOM matchers such as toBeInTheDocument() to Vitest's expect.
import '@testing-library/jest-dom/vitest';

// jsdom has no Web Animations API, which Svelte transitions run on. This stub
// finishes every animation on the next microtask, so intros and outros complete.
if (!('animate' in Element.prototype)) {
	Object.defineProperty(Element.prototype, 'animate', {
		configurable: true,
		value(): Partial<Animation> {
			const animation: Partial<Animation> = {
				onfinish: null,
				currentTime: 0,
				cancel() {}
			};
			queueMicrotask(() => animation.onfinish?.call(animation as Animation, {} as never));
			return animation;
		}
	});
}

// jsdom has no matchMedia, and svelte/motion reads it on import. Default to
// "no match"; tests that need a media query stub it themselves.
if (typeof window.matchMedia !== 'function') {
	Object.defineProperty(window, 'matchMedia', {
		configurable: true,
		writable: true,
		value: (query: string): MediaQueryList =>
			({
				matches: false,
				media: query,
				onchange: null,
				addEventListener() {},
				removeEventListener() {},
				addListener() {},
				removeListener() {},
				dispatchEvent: () => false
			}) as MediaQueryList
	});
}
