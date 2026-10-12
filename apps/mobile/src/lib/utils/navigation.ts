/** Which way a page change moves, so the transition slides the right way. */
export type NavDirection = 'forward' | 'back';

/** History back (popstate with a negative delta) slides back; everything else forward. */
export function navDirection(navigation: { type: string; delta?: number }): NavDirection {
	return navigation.type === 'popstate' && (navigation.delta ?? 0) < 0 ? 'back' : 'forward';
}

export type BackAction =
	'close-sheet' | 'close-drawer' | 'clear-selection' | 'navigate-back' | 'exit';

export interface BackState {
	hasSheet: boolean;
	isDrawerOpen: boolean;
	isSelecting: boolean;
	/** The Inbox or onboarding: back leaves the app from here. */
	isHome: boolean;
}

/**
 * What the Android back button does, most local first: close the top sheet,
 * then the drawer, then leave selection mode, then go back a page, and only
 * from the home screen leave the app.
 */
export function backAction(state: BackState): BackAction {
	if (state.hasSheet) return 'close-sheet';
	if (state.isDrawerOpen) return 'close-drawer';
	if (state.isSelecting) return 'clear-selection';
	return state.isHome ? 'exit' : 'navigate-back';
}

/** Where a list screen was scrolled to, keyed by path, so each mailbox keeps its place. */
export class ScrollMemory {
	#positions = new Map<string, number>();

	save(key: string, top: number): void {
		this.#positions.set(key, top);
	}

	/** The saved position, or 0 for a screen not seen yet. */
	get(key: string): number {
		return this.#positions.get(key) ?? 0;
	}

	clear(): void {
		this.#positions.clear();
	}
}
