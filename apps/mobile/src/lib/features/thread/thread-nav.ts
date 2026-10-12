/** The threads either side of `id` in list order (newest first), or null at either end. */
export function threadNeighbors(
	ids: readonly string[],
	id: string
): { newer: string | null; older: string | null } {
	const index = ids.indexOf(id);
	if (index === -1) return { newer: null, older: null };
	return { newer: ids[index - 1] ?? null, older: ids[index + 1] ?? null };
}

/** Distance a finger must travel sideways before a swipe changes thread. */
export const SWIPE_MIN_PX = 80;

/**
 * Which way a finished touch moved between threads: left reaches the older
 * thread, right the newer one. Mostly vertical moves are scrolls, not swipes.
 */
export function swipeTarget(dx: number, dy: number): 'older' | 'newer' | null {
	if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < Math.abs(dy) * 2) return null;
	return dx < 0 ? 'older' : 'newer';
}

export type ThreadShortcut = 'older' | 'newer' | 'archive' | 'trash' | 'reply';

// Gmail's keys: j older, k newer, e archive, # trash, r reply.
const SHORTCUTS: Record<string, ThreadShortcut> = {
	j: 'older',
	k: 'newer',
	e: 'archive',
	'#': 'trash',
	r: 'reply'
};

/** The thread shortcut a key press means, or null while typing or with Ctrl/Alt/Meta held. */
export function threadShortcut(
	event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'altKey' | 'metaKey' | 'target'>
): ThreadShortcut | null {
	if (event.ctrlKey || event.altKey || event.metaKey) return null;
	const target = event.target as HTMLElement | null;
	if (target?.closest?.('input, textarea, select, [contenteditable=""], [contenteditable="true"]'))
		return null;
	return SHORTCUTS[event.key] ?? null;
}

/** Whether `start` (or a parent up to `root`) scrolls sideways, so a swipe there should scroll it. */
export function scrollsSideways(start: Element | null, root: Element): boolean {
	for (let el = start; el && el !== root; el = el.parentElement) {
		if (el.scrollWidth > el.clientWidth) {
			const overflow = getComputedStyle(el).overflowX;
			if (overflow === 'auto' || overflow === 'scroll') return true;
		}
	}
	return false;
}
