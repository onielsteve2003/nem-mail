import type { Address } from '@nem/shared';

/** The user's own address shows as this in sender lines. */
export const SELF_NAME = 'me';
/** Sender lines name at most this many people. */
const MAX_SENDERS = 3;

function displayName(address: Address, selfEmail: string | undefined): string {
	if (selfEmail && address.email.toLowerCase() === selfEmail.toLowerCase()) return SELF_NAME;
	return address.name?.trim() || address.email.split('@')[0] || address.email;
}

/**
 * The sender line of a row (FR-3.1): one sender in full, several by first name,
 * each person once, the user as "me". The message count is shown separately.
 */
export function senderLine(participants: readonly Address[], selfEmail?: string): string {
	const seen = new Set<string>();
	const unique = participants.filter((address) => {
		const key = address.email.toLowerCase();
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
	const names = unique.map((address) => displayName(address, selfEmail));
	if (names.length === 1) return names[0] ?? '';
	const firstNames = names.map((name) => name.split(/\s+/)[0] ?? name);
	const shown = firstNames.slice(-MAX_SENDERS);
	return firstNames.length > MAX_SENDERS
		? `${firstNames[0]} .. ${shown.slice(1).join(', ')}`
		: shown.join(', ');
}

/**
 * Row time: the clock time today, the month and day this year, else a short date.
 * `locale` is for tests; the app uses the browser's.
 */
export function listTime(iso: string, now: number, locale?: string): string {
	const date = new Date(iso);
	const today = new Date(now);
	if (date.toDateString() === today.toDateString()) {
		return date.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });
	}
	if (date.getFullYear() === today.getFullYear()) {
		return date.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
	}
	return date.toLocaleDateString(locale, { year: '2-digit', month: 'numeric', day: 'numeric' });
}

/** Attachment chips a row shows before folding the rest into "+N". */
export const MAX_ATTACHMENT_CHIPS = 2;
