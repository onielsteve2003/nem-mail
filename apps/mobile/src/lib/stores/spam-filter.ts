import type { Message, ThreadOp } from '@nem/shared';
import type { AIService } from '#lib/ai/service.svelte.js';
import type { MailRepository } from '#lib/data/repositories.js';
import type { MailboxStore } from './mailbox.svelte.js';
import { toastStore, type ToastStore } from './toast.svelte.js';

const MOVED_TO_SPAM = 'Moved to Spam';
const NOT_SPAM = 'Not spam';

export interface SpamFilterOptions {
	mail: MailRepository;
	mailbox: MailboxStore;
	ai: AIService;
	/** The signed-in user, or null; read on every event so account switches are followed. */
	user: () => { id: string; email: string } | null;
	toasts?: ToastStore;
}

/** True for ops that put mail in Spam (a report), false for "Not spam", null otherwise. */
export function spamFeedback(op: ThreadOp): boolean | null {
	if (op.op === 'spam' || (op.op === 'move' && op.to === 'spam')) return true;
	if (op.op === 'notSpam') return false;
	return null;
}

/** The messages a report is about: what others sent, not the user's own replies. */
export function receivedMessages(messages: readonly Message[], selfEmail: string): Message[] {
	const self = selfEmail.toLowerCase();
	return messages.filter((message) => message.from.email.toLowerCase() !== self);
}

/**
 * AI-2 wiring. New inbox mail is classified in the AI worker and moved to Spam when
 * flagged (with a "Not spam" way back); the user's reports teach their saved model.
 * Returns a stop function.
 */
export function connectSpamFilter({
	mail,
	mailbox,
	ai,
	user,
	toasts = toastStore
}: SpamFilterOptions): () => void {
	async function screen(threadId: string): Promise<void> {
		const me = user();
		if (!me || !ai.isEnabled('spam')) return;
		const thread = await mail.get(threadId);
		const latest = receivedMessages(thread.messages, me.email).at(-1);
		if (!latest || !thread.mailboxes.includes('inbox')) return;
		const verdict = await ai.classifySpam(me.id, latest);
		if (!verdict?.value.isSpam) return;
		// A system move: no Undo toast of its own, and no lesson for the model.
		if (!(await mailbox.apply([threadId], { op: 'spam' }, { undoable: false }))) return;
		toasts.show({
			message: `${MOVED_TO_SPAM}: ${thread.subject}`,
			action: { label: NOT_SPAM, onaction: () => void mailbox.apply([threadId], { op: 'notSpam' }) }
		});
	}

	async function learn(threadIds: string[], isSpam: boolean): Promise<void> {
		const me = user();
		if (!me || !ai.isEnabled('spam')) return;
		const threads = await Promise.all(threadIds.map((id) => mail.get(id)));
		const messages = threads.flatMap((thread) => receivedMessages(thread.messages, me.email));
		await ai.learnSpam(me.id, messages, isSpam);
	}

	const unsubscribe = mail.subscribe((event) => {
		if (event.type !== 'mail.new') return;
		screen(event.summary.id).catch((error: unknown) => console.error('Spam check failed', error));
	});
	const unobserve = mailbox.onApplied((threadIds, ops) => {
		const lesson = ops.map(spamFeedback).findLast((value) => value !== null);
		if (lesson === undefined || lesson === null) return;
		learn(threadIds, lesson).catch((error: unknown) =>
			console.error('Spam learning failed', error)
		);
	});
	return () => {
		unsubscribe();
		unobserve();
	};
}
