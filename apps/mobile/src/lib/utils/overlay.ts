const FOCUSABLE = [
	'a[href]',
	'button:not([disabled])',
	'input:not([disabled])',
	'select:not([disabled])',
	'textarea:not([disabled])',
	'[tabindex]:not([tabindex="-1"])'
].join(',');

/** Elements inside `root` that Tab can reach, in DOM order. */
export function getFocusable(root: HTMLElement): HTMLElement[] {
	return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
		(el) => !el.closest('[inert], [aria-hidden="true"]')
	);
}

export interface OverlayOptions {
	/** Called on Escape. Leave it out for overlays that must not close on Escape. */
	onescape?: () => void;
}

// Nested overlays share one lock; the page scrolls again when the last one closes.
let lockCount = 0;
let savedOverflow = '';

/**
 * Svelte action for modal surfaces (sheets, dialogs): moves focus inside,
 * keeps Tab within the node, closes on Escape, locks page scroll, and
 * returns focus to the opener when the node is removed.
 * Focus goes to the first `[data-autofocus]` element, else the first focusable one.
 */
export function overlay(node: HTMLElement, options: OverlayOptions = {}) {
	let { onescape } = options;
	const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;

	if (lockCount++ === 0) {
		savedOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
	}

	const initial = node.querySelector<HTMLElement>('[data-autofocus]') ?? getFocusable(node)[0];
	(initial ?? node).focus();

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && onescape) {
			// Only the topmost overlay closes.
			event.stopPropagation();
			onescape();
			return;
		}
		if (event.key !== 'Tab') return;

		const items = getFocusable(node);
		const first = items[0];
		const last = items[items.length - 1];
		if (!first || !last) {
			event.preventDefault();
			return;
		}
		const active = document.activeElement;
		if (event.shiftKey && (active === first || active === node)) {
			event.preventDefault();
			last.focus();
		} else if (!event.shiftKey && active === last) {
			event.preventDefault();
			first.focus();
		}
	}

	node.addEventListener('keydown', handleKeydown);

	return {
		update(next: OverlayOptions = {}) {
			onescape = next.onescape;
		},
		destroy() {
			node.removeEventListener('keydown', handleKeydown);
			if (--lockCount === 0) document.body.style.overflow = savedOverflow;
			opener?.focus();
		}
	};
}
