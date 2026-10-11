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
