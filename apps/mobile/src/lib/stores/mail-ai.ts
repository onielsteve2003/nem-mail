import type { Category, Message, Thread, ThreadOp } from '@nem/shared';
import { IMPORTANT_THRESHOLD } from '#lib/ai/models/priority-lr.js';
import type { AIService } from '#lib/ai/service.svelte.js';
import type { MailRepository } from '#lib/data/repositories.js';
import type { MailboxStore } from './mailbox.svelte.js';
import { toastStore, type ToastStore } from './toast.svelte.js';

const MOVED_TO_SPAM = 'Moved to Spam';
const NOT_SPAM = 'Not spam';

export interface MailAIOptions {
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

/** The tab a "Move to tab" op teaches, or null. */
export function categoryFeedback(op: ThreadOp): Category | null {
	return op.op === 'setCategory' ? op.category : null;
}

/** True for "Mark important", false for "Mark not important", null otherwise. */
export function importantFeedback(op: ThreadOp): boolean | null {
	if (op.op === 'markImportant') return true;
	if (op.op === 'markNotImportant') return false;
	return null;
}

/** The messages a report is about: what others sent, not the user's own replies. */
export function receivedMessages(messages: readonly Message[], selfEmail: string): Message[] {
	const self = selfEmail.toLowerCase();
	return messages.filter((message) => message.from.email.toLowerCase() !== self);
}

/**
 * Runs the on-device mail models on new mail and learns from the user's corrections.
 * New inbox mail is checked for spam first (AI-2: flagged mail moves to Spam, with a
 * "Not spam" way back), then sorted into a tab (AI-1: set when it differs from the
 * server's), then scored for priority (AI-6: the Important marker when the score is high).
 * "Report spam", "Not spam", "Move to tab" and marking important teach the user's saved models.
 * Returns a stop function.
 */
export function connectMailAI({
	mail,
	mailbox,
	ai,
	user,
	toasts = toastStore
}: MailAIOptions): () => void {
	async function screen(threadId: string): Promise<void> {
		const me = user();
		if (!me) return;
		const thread = await mail.get(threadId);
		const latest = receivedMessages(thread.messages, me.email).at(-1);
		if (!latest || !thread.mailboxes.includes('inbox')) return;

		const spam = await ai.classifySpam(me.id, latest);
		if (spam?.value.isSpam) {
			// A system move: no Undo toast of its own, and no lesson for the model.
			if (!(await mailbox.apply([threadId], { op: 'spam' }, { undoable: false }))) return;
			toasts.show({
				message: `${MOVED_TO_SPAM}: ${thread.subject}`,
				action: {
					label: NOT_SPAM,
					onaction: () => void mailbox.apply([threadId], { op: 'notSpam' })
				}
			});
			return;
		}
		const tab = await ai.classifyCategory(me.id, latest);
		if (tab && tab.value !== thread.category) {
			await mailbox.apply(
				[threadId],
				{ op: 'setCategory', category: tab.value },
				{ undoable: false }
			);
		}
		const scores = await ai.scorePriority(me, [
			{ ...thread, category: tab?.value ?? thread.category }
		]);
		const score = scores?.[threadId];
		if (score && score.value >= IMPORTANT_THRESHOLD && !thread.isImportant) {
			await mailbox.apply([threadId], { op: 'markImportant' }, { undoable: false });
		}
	}

	function received(threads: Thread[], email: string): Message[] {
		return threads.flatMap((thread) => receivedMessages(thread.messages, email));
	}

	async function learn(threadIds: string[], ops: readonly ThreadOp[]): Promise<void> {
		const me = user();
		if (!me) return;
		const isSpam = ops.map(spamFeedback).findLast((value) => value !== null) ?? null;
		const tab = ops.map(categoryFeedback).findLast((value) => value !== null) ?? null;
		const important = ops.map(importantFeedback).findLast((value) => value !== null) ?? null;
		if (isSpam === null && tab === null && important === null) return;
		const threads = await Promise.all(threadIds.map((id) => mail.get(id)));
		const messages = received(threads, me.email);
		if (isSpam !== null) await ai.learnSpam(me.id, messages, isSpam);
		if (tab !== null) await ai.learnCategory(me.id, messages, tab);
		if (important !== null) await ai.learnPriority(me, threads, important, 'mark');
	}

	const unsubscribe = mail.subscribe((event) => {
		if (event.type !== 'mail.new') return;
		screen(event.summary.id).catch((error: unknown) => console.error('Mail AI failed', error));
	});
	const unobserve = mailbox.onApplied((threadIds, ops) => {
		learn(threadIds, ops).catch((error: unknown) =>
			console.error('Mail AI learning failed', error)
		);
	});
	return () => {
		unsubscribe();
		unobserve();
	};
}
