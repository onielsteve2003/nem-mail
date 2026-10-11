import { cubicIn, cubicOut, quintOut } from 'svelte/easing';
import type { SpringOptions, TweenOptions } from 'svelte/motion';

export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/** True when the user asked the OS for less motion. Read at call time, so it is never stale. */
export function prefersReducedMotion(): boolean {
	return (
		typeof window !== 'undefined' &&
		typeof window.matchMedia === 'function' &&
		window.matchMedia(REDUCED_MOTION_QUERY).matches
	);
}

/** Durations in ms. They mirror the --nm-duration-* tokens in tokens.css. */
export const DURATIONS = {
	instant: 80,
	fast: 150,
	base: 240,
	slow: 360,
	slower: 520
} as const;

/** JS counterparts of the --nm-ease-* curves: standard, emphasized (decelerating) and exit. */
export const EASINGS = {
	standard: cubicOut,
	emphasized: quintOut,
	accelerate: cubicIn
} as const;

/** Spring presets for `new Spring(value, springPreset('snappy'))`. */
export const SPRINGS = {
	/** Indicators, toggles, chips: quick with no visible overshoot. */
	snappy: { stiffness: 0.3, damping: 0.8 },
	/** Sheets and drawers settling after a drag. */
	gentle: { stiffness: 0.12, damping: 0.65 },
	/** Playful moments such as the compose button and AI orb. */
	bouncy: { stiffness: 0.18, damping: 0.4 }
} as const satisfies Record<string, SpringOptions>;

/** Tween presets for `new Tween(value, tweenPreset('base'))`. */
export const TWEENS = {
	fast: { duration: DURATIONS.fast, easing: EASINGS.standard },
	base: { duration: DURATIONS.base, easing: EASINGS.standard },
	slow: { duration: DURATIONS.slow, easing: EASINGS.emphasized }
} as const satisfies Record<string, TweenOptions<number>>;

/** A spring that snaps straight to its target under reduced motion. */
export function springPreset(name: keyof typeof SPRINGS): SpringOptions {
	return prefersReducedMotion() ? { stiffness: 1, damping: 1 } : { ...SPRINGS[name] };
}

/** A tween that jumps straight to its target under reduced motion. */
export function tweenPreset(name: keyof typeof TWEENS): TweenOptions<number> {
	return prefersReducedMotion() ? { ...TWEENS[name], duration: 0 } : { ...TWEENS[name] };
}
