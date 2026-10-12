import type { Address, Message } from '@nem/shared';

/** The user's own address shows as this in recipient lines. */
export const SELF_NAME = 'me';
/** Threads longer than this fold their middle messages into one "N earlier messages" row. */
export const FOLD_AFTER = 4;

export type MessageItem =
	{ kind: 'message'; message: Message } | { kind: 'group'; count: number; ids: string[] };

/** Messages open on arrival (FR-4.1): the latest one, plus any the user has not read. */
export function initialExpanded(messages: readonly Message[]): string[] {
	const last = messages.at(-1);
	return messages
		.filter((message) => message === last || !message.isRead)
		.map((message) => message.id);
}

/**
 * The cards a thread shows: every message, or for a long thread the first,
 * an "N earlier messages" group, and the last two, until the group is opened.
 */
export function messageLayout(messages: readonly Message[], showAll: boolean): MessageItem[] {
	const items = messages.map((message): MessageItem => ({ kind: 'message', message }));
	if (showAll || messages.length <= FOLD_AFTER) return items;
	const hidden = messages.slice(1, -2);
	return [
		items[0]!,
		{ kind: 'group', count: hidden.length, ids: hidden.map((message) => message.id) },
		...items.slice(-2)
	];
}

/** A person's name, the email's local part when there is no name, or "me". */
export function addressName(address: Address, selfEmail?: string): string {
	if (selfEmail && address.email.toLowerCase() === selfEmail.toLowerCase()) return SELF_NAME;
	return address.name?.trim() || address.email.split('@')[0] || address.email;
}

/** "to me, Ada" under the sender: To and Cc, plus Bcc on mail the user sent. */
export function recipientLine(message: Message, selfEmail?: string): string {
	const isFromSelf = !!selfEmail && message.from.email.toLowerCase() === selfEmail.toLowerCase();
	const recipients = [...message.to, ...message.cc, ...(isFromSelf ? message.bcc : [])];
	const names = recipients.map((address) => addressName(address, selfEmail));
	return names.length > 0 ? `to ${[...new Set(names)].join(', ')}` : 'to undisclosed recipients';
}

/**
 * Card time: the clock time today, else the date and time, with the year
 * when it is not this year. `locale` is for tests; the app uses the browser's.
 */
export function messageTime(iso: string, now: number, locale?: string): string {
	const date = new Date(iso);
	const today = new Date(now);
	const time: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };
	if (date.toDateString() === today.toDateString()) return date.toLocaleTimeString(locale, time);
	const year = date.getFullYear() === today.getFullYear() ? undefined : 'numeric';
	return date.toLocaleString(locale, { month: 'short', day: 'numeric', year, ...time });
}

/** The full date in the recipient details. */
export function fullTime(iso: string, locale?: string): string {
	return new Date(iso).toLocaleString(locale, { dateStyle: 'full', timeStyle: 'short' });
}

/** Whether "Reply all" would reach anyone beyond a plain reply: more than one other person is on the message. */
export function canReplyAll(message: Message, selfEmail?: string): boolean {
	const self = selfEmail?.toLowerCase();
	const others = new Set(
		[message.from, ...message.to, ...message.cc]
			.map((address) => address.email.toLowerCase())
			.filter((email) => email !== self)
	);
	return others.size > 1;
}
