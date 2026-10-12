import type { Draft, SendResponse } from '@nem/shared';
import type { DraftRepository } from '#lib/data/repositories.js';
import type { ToastStore } from '#lib/stores/toast.svelte.js';
import { toAppError } from '#lib/utils/errors.js';
import type { ComposeAttachment } from './attachments.js';
import type { Recipient } from './recipients.js';

export const SEND_COPY = {
	sending: 'Sending…',
	sent: 'Sent',
	undo: 'Undo',
	retry: 'Retry',
	cancelled: 'Sending cancelled',
	tooLate: 'Too late to undo. The message was sent.',
	undoFailed: "Couldn't undo. Check Outbox.",
	failed: "Couldn't send.",
	savedToDrafts: "Couldn't send. Saved in Drafts.",
	noRecipients: 'Add at least one recipient',
	invalid: (email: string) => `Fix the address ${email}`,
	uploading: 'Wait for attachments to finish uploading',
	failedFiles: 'Remove the attachments that failed'
};

/** Why compose cannot send yet, or null when it can (FR-5.6). */
export function sendProblem(
	recipients: { to: Recipient[]; cc: Recipient[]; bcc: Recipient[] },
	attachments: ComposeAttachment[]
): string | null {
	const all = [...recipients.to, ...recipients.cc, ...recipients.bcc];
	if (all.length === 0) return SEND_COPY.noRecipients;
	const invalid = all.find((r) => !r.isValid);
	if (invalid) return SEND_COPY.invalid(invalid.email);
	if (attachments.some((a) => a.status === 'uploading')) return SEND_COPY.uploading;
	if (attachments.some((a) => a.status === 'error')) return SEND_COPY.failedFiles;
	return null;
}

export interface SendDeps {
	drafts: DraftRepository;
	toasts: ToastStore;
	/** The message is in the outbox; lists and the open thread should refresh. */
	onsent: (response: SendResponse) => void;
	/** Undo brought the message back as this draft; compose should reopen it. */
	onundo: (draft: Draft) => void;
}

/**
 * Sends a draft: "Sending…", then "Sent" with Undo for the outbox window.
 * On failure the draft is saved so nothing is lost, and the toast offers
 * Retry when the error is retryable. Resolves true when it was queued.
 */
export async function sendDraft(draft: Draft, deps: SendDeps): Promise<boolean> {
	const { drafts, toasts } = deps;
	const sending = toasts.show({ message: SEND_COPY.sending, duration: 0 });
	try {
		const response = await drafts.send({ draft });
		toasts.dismiss(sending);
		deps.onsent(response);
		toasts.show({
			message: SEND_COPY.sent,
			tone: 'success',
			action: { label: SEND_COPY.undo, onaction: () => void undoSend(response, deps) }
		});
		return true;
	} catch (error) {
		toasts.dismiss(sending);
		const saved = await drafts.save(draft).then(
			() => true,
			() => false
		);
		const { retryable } = toAppError(error);
		toasts.show({
			message: saved ? SEND_COPY.savedToDrafts : SEND_COPY.failed,
			tone: 'error',
			...(retryable && {
				action: { label: SEND_COPY.retry, onaction: () => void sendDraft(draft, deps) }
			})
		});
		return false;
	}
}

async function undoSend(response: SendResponse, deps: SendDeps): Promise<void> {
	try {
		const draft = await deps.drafts.cancelSend(response.messageId);
		deps.toasts.show({ message: SEND_COPY.cancelled });
		deps.onundo(draft);
	} catch (error) {
		const tooLate = toAppError(error).code === 'CONFLICT';
		deps.toasts.show({
			message: tooLate ? SEND_COPY.tooLate : SEND_COPY.undoFailed,
			tone: 'error'
		});
	}
}
