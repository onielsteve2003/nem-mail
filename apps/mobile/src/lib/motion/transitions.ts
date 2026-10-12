import type { EasingFunction, TransitionConfig } from 'svelte/transition';
import { DURATIONS, EASINGS, prefersReducedMotion } from './presets.js';

interface MotionParams {
	delay?: number;
	duration?: number;
	easing?: EasingFunction;
}

/** Under reduced motion every transition finishes at once: no movement, no fade. */
const NO_MOTION: TransitionConfig = { duration: 0 };

/** Bottom sheet entering from (and leaving to) the bottom edge. */
export function sheetIn(_node: Element, params: MotionParams = {}): TransitionConfig {
	if (prefersReducedMotion()) return NO_MOTION;
	const { delay = 0, duration = DURATIONS.slow, easing = EASINGS.emphasized } = params;
	return { delay, duration, easing, css: (_t, u) => `transform: translateY(${u * 100}%);` };
}

interface FadeScaleParams extends MotionParams {
	/** Scale at the start of the enter (and end of the exit). */
	start?: number;
}

/** Fade with a slight zoom, for popovers, menus and dialogs. */
export function fadeScale(_node: Element, params: FadeScaleParams = {}): TransitionConfig {
	if (prefersReducedMotion()) return NO_MOTION;
	const { delay = 0, duration = DURATIONS.base, easing = EASINGS.standard, start = 0.95 } = params;
	return {
		delay,
		duration,
		easing,
		css: (t) => `opacity: ${t}; transform: scale(${start + (1 - start) * t});`
	};
}

interface SlideStackParams extends MotionParams {
	/** 1 when pushing a screen on (enters from the end), -1 when going back. */
	direction?: 1 | -1;
	/** Horizontal travel as a percentage of the element width. */
	distance?: number;
}

/** Stack navigation: screens slide horizontally and cross-fade. */
export function slideStack(_node: Element, params: SlideStackParams = {}): TransitionConfig {
	if (prefersReducedMotion()) return NO_MOTION;
	const {
		delay = 0,
		duration = DURATIONS.slow,
		easing = EASINGS.emphasized,
		direction = 1,
		distance = 30
	} = params;
	return {
		delay,
		duration,
		easing,
		css: (t, u) => `opacity: ${t}; transform: translateX(${u * distance * direction}%);`
	};
}

/**
 * Collapses an element's height to zero, for a list row leaving after
 * archive or delete. This is the one transition that animates layout:
 * the rows below must move up, and it runs on a single short-lived row.
 */
export function collapse(node: Element, params: MotionParams = {}): TransitionConfig {
	if (prefersReducedMotion()) return NO_MOTION;
	const { delay = 0, duration = DURATIONS.base, easing = EASINGS.standard } = params;
	const style = getComputedStyle(node);
	const height = parseFloat(style.height) || 0;
	const paddingTop = parseFloat(style.paddingTop) || 0;
	const paddingBottom = parseFloat(style.paddingBottom) || 0;
	return {
		delay,
		duration,
		easing,
		css: (t) =>
			`overflow: hidden; opacity: ${t}; height: ${t * height}px;` +
			` padding-top: ${t * paddingTop}px; padding-bottom: ${t * paddingBottom}px;`
	};
}

/** Where a morph starts: the rect of the control that opened the surface. */
type Rect = Pick<DOMRect, 'top' | 'right' | 'bottom' | 'left' | 'width' | 'height'>;

interface MorphParams extends MotionParams {
	origin?: Rect | null;
}

/**
 * Liquid morph: the surface grows out of `origin` (the compose button).
 * A clip-path the size of the origin, moved onto it, opens to the full surface,
 * so only transform, clip-path and opacity change. Without an origin it slides up like a sheet.
 */
export function morph(node: Element, params: MorphParams = {}): TransitionConfig {
	if (prefersReducedMotion()) return NO_MOTION;
	const { origin, delay = 0, duration = DURATIONS.slow, easing = EASINGS.emphasized } = params;
	if (!origin) return sheetIn(node, { delay, duration, easing });
	const box = node.getBoundingClientRect();
	const top = Math.max(0, box.bottom - box.top - origin.height);
	const left = Math.max(0, box.right - box.left - origin.width);
	const dx = origin.right - box.right;
	const dy = origin.bottom - box.bottom;
	const from = Math.min(origin.width, origin.height) / 2;
	const to = parseFloat(getComputedStyle(node).borderTopLeftRadius) || 0;
	return {
		delay,
		duration,
		easing,
		css: (t, u) =>
			`opacity: ${Math.min(1, t * 3)};` +
			` transform: translate(${dx * u}px, ${dy * u}px);` +
			` clip-path: inset(${top * u}px 0px 0px ${left * u}px round ${from * u + to * t}px);`
	};
}
