import { Capacitor } from '@capacitor/core';

// Smaller viewport changes are browser toolbars sliding, not a keyboard.
const MIN_KEYBOARD_PX = 120;

/**
 * How much of the layout viewport the on-screen keyboard covers, from the visual
 * viewport. iOS Safari overlays the keyboard instead of resizing the page.
 */
export function keyboardInset(
	layoutHeight: number,
	visualHeight: number,
	offsetTop: number
): number {
	const covered = Math.round(layoutHeight - visualHeight - offsetTop);
	return covered >= MIN_KEYBOARD_PX ? covered : 0;
}

/**
 * Tracks the on-screen keyboard on `root`: `data-keyboard="open"` while it shows, and
 * `--nm-keyboard-inset` (web only) so bottom sheets can sit above it. The native app
 * uses the Capacitor Keyboard plugin, where the web view resizes itself, so the inset
 * stays 0 there. Returns a stop function.
 */
export function watchKeyboard(root: HTMLElement): () => void {
	const set = (inset: number, isOpen: boolean) => {
		root.style.setProperty('--nm-keyboard-inset', `${inset}px`);
		root.dataset['keyboard'] = isOpen ? 'open' : 'closed';
	};

	if (Capacitor.isNativePlatform()) {
		let stopped = false;
		let remove: (() => void) | undefined;
		void import('@capacitor/keyboard').then(async ({ Keyboard }) => {
			const handles = await Promise.all([
				Keyboard.addListener('keyboardWillShow', () => set(0, true)),
				Keyboard.addListener('keyboardWillHide', () => set(0, false))
			]);
			remove = () => handles.forEach((handle) => void handle.remove());
			if (stopped) remove();
		});
		return () => {
			stopped = true;
			remove?.();
		};
	}

	const viewport = window.visualViewport;
	if (!viewport) return () => {};
	const update = () => {
		const inset = keyboardInset(window.innerHeight, viewport.height, viewport.offsetTop);
		set(inset, inset > 0);
	};
	viewport.addEventListener('resize', update);
	viewport.addEventListener('scroll', update);
	update();
	return () => {
		viewport.removeEventListener('resize', update);
		viewport.removeEventListener('scroll', update);
	};
}
