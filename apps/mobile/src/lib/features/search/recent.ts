/** How many recent searches are kept per account (FR-7.4). */
export const RECENT_LIMIT = 8;

/** Small slice of Storage, so tests can pass a fake. */
export type RecentStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** localStorage key; one list per account so switching accounts never shows the other's searches. */
export function recentKey(userId: string): string {
	return `nem-mail:recent-searches:${userId}`;
}

/** The account's recent searches, newest first. Unreadable or blocked storage gives none. */
export function loadRecent(storage: RecentStorage | undefined, userId: string): string[] {
	try {
		const raw = storage?.getItem(recentKey(userId));
		const parsed: unknown = raw ? JSON.parse(raw) : [];
		return Array.isArray(parsed)
			? parsed.filter((q): q is string => typeof q === 'string').slice(0, RECENT_LIMIT)
			: [];
	} catch {
		return [];
	}
}

/** Puts `query` first (dropping an older copy, ignoring case), keeps RECENT_LIMIT, and saves. */
export function addRecent(list: string[], query: string): string[] {
	const q = query.trim().replace(/\s+/g, ' ');
	if (!q) return list;
	const lower = q.toLowerCase();
	return [q, ...list.filter((item) => item.toLowerCase() !== lower)].slice(0, RECENT_LIMIT);
}

/** Saves the list; a full or blocked storage only means it is not remembered. */
export function saveRecent(
	storage: RecentStorage | undefined,
	userId: string,
	list: string[]
): void {
	try {
		if (list.length) storage?.setItem(recentKey(userId), JSON.stringify(list));
		else storage?.removeItem(recentKey(userId));
	} catch {
		// Private mode or quota: recent searches are a convenience.
	}
}
