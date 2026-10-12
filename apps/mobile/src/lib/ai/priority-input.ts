import type { Address, Thread, ThreadSummary } from '@nem/shared';
import type { ContactRepository } from '#lib/data/repositories.js';
import type { PriorityInput } from './models/priority-lr.js';

/** How many top contacts feed "how often you mail this sender". The contacts API caps at 20. */
const PRIORITY_CONTACTS = 20;

/**
 * Messages exchanged with each top contact, by lower-case email. Without contacts
 * (none yet, or the call failed) every sender counts as a stranger.
 */
export async function senderFrequencies(
	contacts: ContactRepository | null
): Promise<ReadonlyMap<string, number>> {
	try {
		const list = (await contacts?.search({ q: '', limit: PRIORITY_CONTACTS })) ?? [];
		return new Map(list.map((c) => [c.email.toLowerCase(), c.frequency]));
	} catch {
		return new Map();
	}
}

/** Who a thread went to: the summary's list, or every message's To and Cc. */
function recipientsOf(thread: ThreadSummary | Thread): Address[] {
	if (thread.recipients) return thread.recipients;
	if (!('messages' in thread)) return [];
	return thread.messages.flatMap((message) => [...message.to, ...message.cc]);
}

/**
 * What the priority model reads about a thread, from the user's point of view: the
 * latest sender who is not the user, and how often the user mails with them
 * (`frequencies`, by lower-case email, from contacts).
 */
export function priorityInput(
	thread: ThreadSummary | Thread,
	selfEmail: string,
	frequencies: ReadonlyMap<string, number>
): PriorityInput {
	const self = selfEmail.toLowerCase();
	const sender =
		thread.participants.findLast((p) => p.email.toLowerCase() !== self) ?? thread.participants[0];
	const fromEmail = sender?.email.toLowerCase() ?? '';
	const recipients = new Set(recipientsOf(thread).map((r) => r.email.toLowerCase()));
	const latest = 'messages' in thread ? thread.messages.at(-1) : undefined;
	return {
		fromEmail,
		subject: thread.subject,
		text: latest?.bodyText ?? thread.snippet,
		isDirect: recipients.has(self),
		recipientCount: Math.max(recipients.size, 1),
		messageCount: thread.messageCount,
		category: thread.category,
		hasAttachments: thread.attachments.length > 0,
		senderFrequency: frequencies.get(fromEmail) ?? 0
	};
}
