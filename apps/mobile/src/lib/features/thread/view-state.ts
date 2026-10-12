import type { ThreadEntry } from '#lib/stores/thread.svelte.js';

export type ThreadViewState = 'loading' | 'not-found' | 'error' | 'ready';

/** Which screen the thread view shows for a store entry (none yet means loading). */
export function threadViewState(entry: ThreadEntry | undefined): ThreadViewState {
	if (entry?.thread) return 'ready';
	if (!entry || entry.status === 'loading') return 'loading';
	return entry.error?.code === 'NOT_FOUND' ? 'not-found' : 'error';
}
