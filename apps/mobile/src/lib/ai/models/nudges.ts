import type { AIInsight, Thread, ThreadSummary } from '@nem/shared';
import { ownText } from './textrank.js';

const DAY_MS = 86_400_000;
/** A nudge comes after this many days without a reply (PRD AI-9: "Sent 3 days ago"). */
export const FOLLOW_UP_DAYS = 3;
/** Older than this, the conversation has likely moved on elsewhere. */
export const FOLLOW_UP_MAX_DAYS = 30;
/** At most this many nudges at once, so they never bury the inbox. */
export const MAX_NUDGES = 2;
/** At most this many senders for unsubscribe suggestions. */
export const MAX_UNSUBSCRIBE = 1;
/** A sender needs this much mail in the window before its open rate means anything. */
export const MIN_BULK_MAIL = 5;
/** Suggest unsubscribing when the user opens at most this share of a sender's mail. */
export const LOW_OPEN_RATE = 0.5;
/** How far back engagement is measured. */
export const ENGAGEMENT_DAYS = 30;

const QUESTION = /\?\s*(\n|$|\s)/;
const REQUEST =
	/\b(can you|could you|would you|will you|please|let me know|any update|thoughts|get back to me|when can)\b/i;
const NO_REPLY = /^(no-?reply|do-?not-?reply|notifications?|mailer-daemon)@/i;
// Newsletter tabs: receipts, codes and invites (Updates) are wanted even when unread.
const BULK_TABS = new Set(['promotions', 'social', 'forums']);

export interface FollowUpValue {
	threadId: string;
	/** The user's unanswered message, which a follow-up replies to. */
	messageId: string;
	subject: string;
	/** Who it went to, for the row: "Ada" or "Ada and 2 others". */
	to: string;
	days: number;
}
export type FollowUpVerdict = AIInsight<FollowUpValue>;

export interface UnsubscribeValue {
	email: string;
	name: string;
	total: number;
	opened: number;
	/** Their conversations still in the inbox, which unsubscribing archives. */
	inboxThreadIds: string[];
}
export type UnsubscribeVerdict = AIInsight<UnsubscribeValue>;

/**
 * A follow-up nudge for a thread the user wrote last (AI-9): 3 to 30 days ago, asking
 * something (a question or a request), to a person rather than a no-reply address.
 */
export function followUpNudge(
	thread: Thread,
	selfEmail: string,
	now: number
): FollowUpVerdict | null {
	const self = selfEmail.toLowerCase();
	const last = thread.messages.at(-1);
	if (!last || last.status !== 'sent' || last.from.email.toLowerCase() !== self) return null;
	if (thread.mailboxes.includes('trash') || thread.mailboxes.includes('spam')) return null;
	const days = Math.floor((now - Date.parse(last.sentAt)) / DAY_MS);
	if (days < FOLLOW_UP_DAYS || days > FOLLOW_UP_MAX_DAYS) return null;
	const people = [...last.to, ...last.cc].filter(
		(r) => r.email.toLowerCase() !== self && !NO_REPLY.test(r.email)
	);
	const first = people[0];
	if (!first) return null;
	const text = ownText(last.bodyText);
	const isQuestion = QUESTION.test(`${text}\n`);
	if (!isQuestion && !REQUEST.test(text)) return null;
	const name = first.name?.split(' ')[0] || first.email;
	const to =
		people.length > 1
			? `${name} and ${people.length - 1} other${people.length > 2 ? 's' : ''}`
			: name;
	return {
		value: { threadId: thread.id, messageId: last.id, subject: thread.subject, to, days },
		confidence: isQuestion ? 0.8 : 0.65,
		explanation: `You ${isQuestion ? 'asked a question' : 'made a request'} ${days} days ago and nobody has replied since.`,
		source: 'heuristic'
	};
}

/**
 * Newsletter senders the user rarely opens (AI-12): at least MIN_BULK_MAIL in the last
 * ENGAGEMENT_DAYS from one address in Promotions, Social, or Forums, at most
 * LOW_OPEN_RATE opened. The least opened first.
 */
export function unsubscribeSuggestions(
	threads: readonly ThreadSummary[],
	selfEmail: string,
	now: number
): UnsubscribeVerdict[] {
	const self = selfEmail.toLowerCase();
	const since = now - ENGAGEMENT_DAYS * DAY_MS;
	const senders = new Map<string, UnsubscribeValue>();
	for (const thread of threads) {
		const sender = thread.participants[0];
		const email = sender?.email.toLowerCase();
		if (!sender || !email || email === self || !BULK_TABS.has(thread.category ?? '')) continue;
		if (Date.parse(thread.lastMessageAt) < since) continue;
		const stats = senders.get(email) ?? {
			email,
			name: sender.name || email,
			total: 0,
			opened: 0,
			inboxThreadIds: []
		};
		stats.total += 1;
		if (!thread.isUnread) stats.opened += 1;
		if (thread.mailboxes.includes('inbox')) stats.inboxThreadIds.push(thread.id);
		senders.set(email, stats);
	}
	return [...senders.values()]
		.filter((s) => s.total >= MIN_BULK_MAIL && s.opened / s.total <= LOW_OPEN_RATE)
		.sort((a, b) => a.opened / a.total - b.opened / b.total || b.total - a.total)
		.map((value) => ({
			value,
			// Clearer the more mail there is and the less of it gets opened.
			confidence: Math.min(0.95, 0.5 + (1 - value.opened / value.total) * 0.3 + value.total / 100),
			explanation: `You opened ${value.opened} of ${value.total} emails from this sender in the last ${ENGAGEMENT_DAYS} days.`,
			source: 'heuristic' as const
		}));
}
