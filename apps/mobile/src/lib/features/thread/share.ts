import type { Thread } from '@nem/shared';
import type { ShareContent } from '#lib/utils/share.js';

const NO_SUBJECT = '(no subject)';

/** What "Share" sends for a thread: the subject, then the latest message and who wrote it. */
export function threadShareContent(thread: Thread): ShareContent {
	const latest = thread.messages.at(-1);
	const sender = latest ? latest.from.name || latest.from.email : null;
	return {
		title: thread.subject || NO_SUBJECT,
		text: latest && sender ? `${sender}:\n${latest.bodyText.trim()}` : thread.snippet
	};
}
