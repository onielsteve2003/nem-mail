import type { Address, ComposeMode, Message } from '@nem/shared';
import { sanitizeComposeHtml, signatureHtml, textToHtml } from './body.js';

/** What a reply or forward starts with (FR-5.1). */
export interface Prefill {
	to: Address[];
	cc: Address[];
	subject: string;
	bodyHtml: string;
}

const REPLY_PREFIX = /^\s*re\s*:/i;
const FORWARD_PREFIX = /^\s*(?:fwd?|fw)\s*:/i;
const EMPTY_LINES = '<div><br></div><div><br></div>';

/** `Re: subject`, without stacking a second prefix. */
export function replySubject(subject: string): string {
	return REPLY_PREFIX.test(subject) ? subject : `Re: ${subject}`;
}

/** `Fwd: subject`, without stacking a second prefix. */
export function forwardSubject(subject: string): string {
	return FORWARD_PREFIX.test(subject) ? subject : `Fwd: ${subject}`;
}

function same(a: string, b: string | undefined): boolean {
	return a.toLowerCase() === b?.toLowerCase();
}

/** Drops the user and repeats (case-insensitive), keeping the first occurrence. */
function uniqueOthers(list: Address[], selfEmail: string | undefined, taken = new Set<string>()) {
	return list.filter((address) => {
		const key = address.email.toLowerCase();
		if (same(key, selfEmail) || taken.has(key)) return false;
		taken.add(key);
		return true;
	});
}

/**
 * Who a reply goes to. Reply answers the sender; reply all adds everyone on
 * To and Cc. Replying to your own message goes to the people you wrote to.
 * The user is never a recipient, and nobody appears twice.
 */
export function replyRecipients(
	mode: 'reply' | 'replyAll',
	message: Message,
	selfEmail: string | undefined
): Pick<Prefill, 'to' | 'cc'> {
	const fromSelf = same(message.from.email, selfEmail);
	const taken = new Set<string>();
	if (mode === 'reply') {
		return { to: uniqueOthers(fromSelf ? message.to : [message.from], selfEmail, taken), cc: [] };
	}
	const to = uniqueOthers(fromSelf ? message.to : [message.from, ...message.to], selfEmail, taken);
	return { to, cc: uniqueOthers(message.cc, selfEmail, taken) };
}

const QUOTE_DATE = new Intl.DateTimeFormat('en-US', {
	weekday: 'short',
	month: 'short',
	day: 'numeric',
	year: 'numeric',
	hour: 'numeric',
	minute: '2-digit'
});

function formatAddress({ name, email }: Address): string {
	return textToHtml(name ? `${name} <${email}>` : email);
}

function messageBody(message: Message): string {
	return message.bodyHtml ? sanitizeComposeHtml(message.bodyHtml) : textToHtml(message.bodyText);
}

/** The quoted original under a reply, or the forwarded message with its headers. */
export function quoteHtml(mode: Exclude<ComposeMode, 'new'>, message: Message): string {
	const date = textToHtml(QUOTE_DATE.format(new Date(message.sentAt)));
	if (mode !== 'forward') {
		return `<div>On ${date}, ${formatAddress(message.from)} wrote:</div><blockquote>${messageBody(message)}</blockquote>`;
	}
	const headers = [
		'---------- Forwarded message ---------',
		`From: ${formatAddress(message.from)}`,
		`Date: ${date}`,
		`Subject: ${textToHtml(message.subject)}`,
		`To: ${message.to.map(formatAddress).join(', ')}`,
		...(message.cc.length ? [`Cc: ${message.cc.map(formatAddress).join(', ')}`] : [])
	];
	return `<div>${headers.join('<br>')}</div><br>${messageBody(message)}`;
}

/** Recipients, subject and body for a reply, reply all or forward of `message`. */
export function prefill(
	mode: Exclude<ComposeMode, 'new'>,
	message: Message,
	selfEmail: string | undefined,
	signature: string
): Prefill {
	const recipients =
		mode === 'forward' ? { to: [], cc: [] } : replyRecipients(mode, message, selfEmail);
	return {
		...recipients,
		subject: mode === 'forward' ? forwardSubject(message.subject) : replySubject(message.subject),
		bodyHtml: EMPTY_LINES + signatureHtml(signature) + quoteHtml(mode, message)
	};
}
