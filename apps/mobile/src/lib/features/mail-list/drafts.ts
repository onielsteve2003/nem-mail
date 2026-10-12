import type { Draft } from '@nem/shared';
import { senderLine } from './format.js';

export const NO_RECIPIENTS = '(no recipients)';

/** "To: Ada, Grace" for a draft row, or a placeholder before anyone is added. */
export function draftRecipients(draft: Draft): string {
	const all = [...draft.to, ...draft.cc, ...draft.bcc];
	return all.length > 0 ? `To: ${senderLine(all)}` : NO_RECIPIENTS;
}

/** Plain text of a draft body for the snippet. DOMParser runs no scripts and loads nothing. */
export function draftSnippet(html: string): string {
	const text = new DOMParser().parseFromString(html, 'text/html').body.textContent ?? '';
	return text.replace(/\s+/g, ' ').trim();
}
