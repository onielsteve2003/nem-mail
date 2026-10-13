import type { Thread } from '@nem/shared';

/** About three sentences of text: below this a thread is read faster than a summary. */
const SUMMARY_MIN_CHARS = 280;

/** Whether a thread is long enough that its summary card should show while it loads. */
export function mayNeedSummary(thread: Thread): boolean {
	let length = 0;
	for (const message of thread.messages) length += message.bodyText.length;
	return length >= SUMMARY_MIN_CHARS;
}
