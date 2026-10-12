/** Scroll position the bar last reacted to, and whether it shows. */
export interface ScrollHideState {
	anchorY: number;
	isVisible: boolean;
}

/** Ignore jitter smaller than this many pixels (momentum, rubber-banding). */
export const SCROLL_HIDE_THRESHOLD = 8;
/** Always show the bar this close to the top. */
export const SCROLL_HIDE_TOP = 56;

export const SCROLL_HIDE_INITIAL: ScrollHideState = { anchorY: 0, isVisible: true };

/** Hide on scroll down, show on scroll up or near the top (T4.3). */
export function nextScrollHide(state: ScrollHideState, y: number): ScrollHideState {
	if (y <= SCROLL_HIDE_TOP) return { anchorY: y, isVisible: true };
	const delta = y - state.anchorY;
	if (Math.abs(delta) < SCROLL_HIDE_THRESHOLD) return state;
	return { anchorY: y, isVisible: delta < 0 };
}
