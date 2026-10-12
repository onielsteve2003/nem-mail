import type { Category, ThreadSummary } from '@nem/shared';
import { CATEGORIES } from '@nem/shared';
import { senderLine } from './format.js';

/** Inbox tab names in tab order (FR-2.2). */
export const CATEGORY_TITLES: Record<Category, string> = {
	primary: 'Primary',
	promotions: 'Promotions',
	social: 'Social',
	updates: 'Updates',
	forums: 'Forums'
};

/** Tabs other than Primary, which show as bundle rows at the top of Primary. */
export const BUNDLED_CATEGORIES = CATEGORIES.filter((category) => category !== 'primary');

/** Bundles name at most this many unread senders. */
const BUNDLE_SENDERS = 3;

/** "Shop, Ada, Grace": the latest unread senders in a tab, each once. */
export function bundleSenders(threads: readonly ThreadSummary[]): string {
	const seen = new Set<string>();
	const latest = threads
		.filter((thread) => thread.isUnread)
		.flatMap((thread) => thread.participants.at(-1) ?? [])
		.filter((address) => !seen.has(address.email) && Boolean(seen.add(address.email)))
		.slice(0, BUNDLE_SENDERS);
	return latest.length > 0 ? senderLine(latest) : '';
}

/** "3 new" for tabs and bundles; "99+ new" past 99. */
export function newCountLabel(count: number): string {
	return `${count > 99 ? '99+' : count} new`;
}
