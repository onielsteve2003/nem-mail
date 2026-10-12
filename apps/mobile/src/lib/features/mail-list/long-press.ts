import { hapticTick } from '#lib/utils/haptics.js';

/** How long a finger must rest on a row to start multi-select. */
export const LONG_PRESS_MS = 500;
/** Moving further than this is a scroll or a swipe, not a press. */
export const LONG_PRESS_SLOP_PX = 10;

/**
 * Svelte action: calls `onlongpress` after a still press. The click that ends
 * the press is swallowed so the row does not open, and the browser's own
 * long-press menu (link preview, contextmenu) starts the press instead.
 */
export function longPress(node: HTMLElement, onlongpress: () => void) {
	let callback = onlongpress;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let start = { x: 0, y: 0 };
	let didFire = false;

	function cancel(): void {
		clearTimeout(timer);
		timer = undefined;
	}

	function fire(): void {
		cancel();
		didFire = true;
		hapticTick();
		callback();
	}

	function onpointerdown(event: PointerEvent): void {
		didFire = false;
		if (!event.isPrimary || event.button !== 0) return;
		start = { x: event.clientX, y: event.clientY };
		cancel();
		timer = setTimeout(fire, LONG_PRESS_MS);
	}

	function onpointermove(event: PointerEvent): void {
		if (timer === undefined) return;
		const moved = Math.hypot(event.clientX - start.x, event.clientY - start.y);
		if (moved > LONG_PRESS_SLOP_PX) cancel();
	}

	function oncontextmenu(event: Event): void {
		event.preventDefault();
		if (!didFire) fire();
	}

	function onclick(event: MouseEvent): void {
		if (!didFire) return;
		didFire = false;
		event.preventDefault();
		event.stopPropagation();
	}

	node.addEventListener('pointerdown', onpointerdown);
	node.addEventListener('pointermove', onpointermove);
	node.addEventListener('pointerup', cancel);
	node.addEventListener('pointercancel', cancel);
	node.addEventListener('contextmenu', oncontextmenu);
	node.addEventListener('click', onclick, true);
	return {
		update(next: () => void) {
			callback = next;
		},
		destroy() {
			cancel();
			node.removeEventListener('pointerdown', onpointerdown);
			node.removeEventListener('pointermove', onpointermove);
			node.removeEventListener('pointerup', cancel);
			node.removeEventListener('pointercancel', cancel);
			node.removeEventListener('contextmenu', oncontextmenu);
			node.removeEventListener('click', onclick, true);
		}
	};
}
