/** Dismissed nudges kept per account, newest last; old ones fall off. */
export const DISMISSED_LIMIT = 100;

/** Small slice of Storage, so tests can pass a fake. */
export type DismissStorage = Pick<Storage, 'getItem' | 'setItem'>;

/** localStorage key, one list per account. */
export function dismissedKey(userId: string): string {
	return `nem-mail:dismissed-nudges:${userId}`;
}

/** Nudge keys the account dismissed. Unreadable or blocked storage gives none. */
export function loadDismissed(storage: DismissStorage | undefined, userId: string): string[] {
	try {
		const raw = storage?.getItem(dismissedKey(userId));
		const parsed: unknown = raw ? JSON.parse(raw) : [];
		return Array.isArray(parsed) ? parsed.filter((k): k is string => typeof k === 'string') : [];
	} catch {
		return [];
	}
}

/** Adds a key and saves; a full or blocked storage only means it shows again next visit. */
export function dismiss(
	storage: DismissStorage | undefined,
	userId: string,
	list: string[],
	key: string
): string[] {
	const next = [...list.filter((k) => k !== key), key].slice(-DISMISSED_LIMIT);
	try {
		storage?.setItem(dismissedKey(userId), JSON.stringify(next));
	} catch {
		// Remembered for this visit only.
	}
	return next;
}

/** A follow-up nudge is for one message: a new unanswered message nudges again. */
export const followUpKey = (messageId: string) => `followup:${messageId}`;
export const unsubscribeKey = (email: string) => `unsubscribe:${email.toLowerCase()}`;
