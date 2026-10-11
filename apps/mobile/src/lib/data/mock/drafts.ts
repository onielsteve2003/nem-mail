import {
	AppError,
	DraftSchema,
	MAX_ATTACHMENT_BYTES,
	SendRequestSchema,
	STORED_MAILBOXES,
	type Address,
	type Attachment,
	type Draft,
	type Message,
	type SendRequest,
	type SendResponse,
	type StoredMailbox,
	type Thread
} from '@nem/shared';
import type { DraftRepository } from '../repositories.js';
import { newId, validate, type MockContext } from './context.js';
import { stripOwner, type MockDb, type Owned } from './db.js';
import { ownThread } from './mail.js';

/** How long a sent message waits in the outbox so it can be undone (FR-5.6). */
export const SEND_DELAY_MS = 5000;

export class MockDraftRepository implements DraftRepository {
	readonly #ctx: MockContext;

	constructor(ctx: MockContext) {
		this.#ctx = ctx;
	}

	/** Drafts, most recently edited first. */
	list(): Promise<Draft[]> {
		return this.#ctx.authed(async (db, userId) =>
			(await db.getAllFromIndex('drafts', 'byOwner', userId))
				.map((d) => stripOwner(d))
				.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
		);
	}

	get(draftId: string): Promise<Draft> {
		return this.#ctx.authed(async (db, userId) => stripOwner(await ownDraft(db, userId, draftId)));
	}

	save(draft: Draft): Promise<Draft> {
		return this.#ctx.authed(async (db, userId) => {
			const valid = validate(DraftSchema, draft);
			const existing = await db.get('drafts', valid.id);
			if (existing && existing.ownerId !== userId)
				throw new AppError('FORBIDDEN', 'Not your draft');
			await db.put('drafts', { ...valid, ownerId: userId });
			return valid;
		});
	}

	remove(draftId: string): Promise<void> {
		return this.#ctx.authed(async (db, userId) => {
			await ownDraft(db, userId, draftId);
			await db.delete('drafts', draftId);
		});
	}

	/** Stores the bytes locally. @throws AppError PAYLOAD_TOO_LARGE over 10 MB (FR-5.4). */
	uploadAttachment(file: File): Promise<Attachment> {
		return this.#ctx.authed(async (db) => {
			if (file.size > MAX_ATTACHMENT_BYTES) {
				throw new AppError('PAYLOAD_TOO_LARGE', 'Attachments can be up to 10 MB');
			}
			const attachment: Attachment = {
				id: newId('att-'),
				filename: file.name || 'attachment',
				mime: file.type || 'application/octet-stream',
				size: file.size
			};
			await db.put('blobs', file, attachment.id);
			return attachment;
		});
	}

	/**
	 * Turns the draft into a message in the outbox (sent after SEND_DELAY_MS) or,
	 * with `sendAt`, in Scheduled. `deliverDue` moves it to Sent when the time comes.
	 */
	send(request: SendRequest): Promise<SendResponse> {
		return this.#ctx.authed(async (db, userId) => {
			const { draft, sendAt: scheduledFor } = validate(SendRequestSchema, request);
			if (draft.to.length + draft.cc.length + draft.bcc.length === 0) {
				throw new AppError('VALIDATION_FAILED', 'Add at least one recipient');
			}
			const user = await db.get('users', userId);
			if (!user) throw new AppError('UNAUTHORIZED', 'Sign in first');

			const now = this.#ctx.now();
			const sendAt = scheduledFor ?? new Date(now + SEND_DELAY_MS).toISOString();
			const status = scheduledFor ? 'scheduled' : 'outbox';
			const existing = draft.threadId ? await ownThread(db, userId, draft.threadId) : null;
			const threadId = existing?.id ?? newId(`${userId}-x`);
			const message = toMessage(draft, {
				id: newId(`${threadId}m`),
				threadId,
				from: { name: user.name, email: user.email },
				sendAt,
				status
			});
			const thread = withMessage(existing ?? newThread(threadId, message, userId), message);

			const tx = db.transaction(['threads', 'drafts'], 'readwrite');
			await tx.objectStore('threads').put(thread);
			await tx.objectStore('drafts').delete(draft.id);
			await tx.done;
			return { messageId: message.id, threadId, sendAt };
		});
	}

	/** @throws AppError CONFLICT when the message already went out. */
	cancelSend(messageId: string): Promise<Draft> {
		return this.#ctx.authed(async (db, userId) => {
			const threads = await db.getAllFromIndex('threads', 'byOwner', userId);
			const thread = threads.find((t) => t.messages.some((m) => m.id === messageId));
			const message = thread?.messages.find((m) => m.id === messageId);
			if (!thread || !message) throw new AppError('NOT_FOUND', 'Message not found');
			if (message.status === 'sent') throw new AppError('CONFLICT', 'Already sent');

			const draft: Draft = {
				id: newId(`${userId}-d`),
				mode: message.inReplyTo ? 'reply' : 'new',
				threadId: thread.messages.length > 1 ? thread.id : null,
				inReplyTo: message.inReplyTo,
				to: message.to,
				cc: message.cc,
				bcc: message.bcc,
				subject: message.subject,
				bodyHtml: message.bodyHtml ?? '',
				attachments: message.attachments,
				scheduledAt: null,
				updatedAt: new Date(this.#ctx.now()).toISOString()
			};
			const tx = db.transaction(['threads', 'drafts'], 'readwrite');
			const rest = thread.messages.filter((m) => m.id !== messageId);
			if (rest.length === 0) await tx.objectStore('threads').delete(thread.id);
			else await tx.objectStore('threads').put(rebuild({ ...thread, messages: rest }));
			await tx.objectStore('drafts').put({ ...draft, ownerId: userId });
			await tx.done;
			return draft;
		});
	}
}

/**
 * Moves outbox and scheduled messages whose time has come into Sent.
 * Returns how many went out; the arrival simulator calls it on every tick.
 */
export async function deliverDue(db: MockDb, userId: string, now: number): Promise<number> {
	const tx = db.transaction('threads', 'readwrite');
	let delivered = 0;
	for (const thread of await tx.store.index('byOwner').getAll(userId)) {
		const due = (m: Message) =>
			m.status !== 'sent' && m.sendAt !== null && Date.parse(m.sendAt) <= now;
		if (!thread.messages.some(due)) continue;
		const messages = thread.messages.map((m) => {
			if (!due(m)) return m;
			delivered += 1;
			return { ...m, status: 'sent' as const, sentAt: m.sendAt ?? m.sentAt, sendAt: null };
		});
		await tx.store.put(rebuild({ ...thread, messages }, 'sent'));
	}
	await tx.done;
	return delivered;
}

async function ownDraft(db: MockDb, userId: string, draftId: string): Promise<Owned<Draft>> {
	const draft = await db.get('drafts', draftId);
	if (!draft || draft.ownerId !== userId) throw new AppError('NOT_FOUND', 'Draft not found');
	return draft;
}

function toMessage(
	draft: Draft,
	meta: { id: string; threadId: string; from: Address; sendAt: string; status: Message['status'] }
): Message {
	const bodyText = htmlToText(draft.bodyHtml);
	return {
		id: meta.id,
		threadId: meta.threadId,
		from: meta.from,
		to: draft.to,
		cc: draft.cc,
		bcc: draft.bcc,
		subject: draft.subject,
		bodyHtml: draft.bodyHtml,
		bodyText,
		snippet: bodyText.replace(/\s+/g, ' ').trim().slice(0, 140),
		sentAt: meta.sendAt,
		sendAt: meta.sendAt,
		status: meta.status,
		inReplyTo: draft.inReplyTo,
		attachments: draft.attachments,
		isRead: true
	};
}

function newThread(id: string, first: Message, ownerId: string): Owned<Thread> {
	return {
		id,
		subject: first.subject,
		snippet: '',
		participants: [first.from],
		messageCount: 0,
		lastMessageAt: first.sentAt,
		mailboxes: [],
		// Mail the user only sent has no inbox tab.
		category: null,
		labelIds: [],
		isUnread: false,
		isStarred: false,
		isImportant: false,
		isMuted: false,
		snoozedUntil: null,
		attachments: [],
		messages: [],
		ownerId
	};
}

function withMessage(thread: Owned<Thread>, message: Message): Owned<Thread> {
	return rebuild({ ...thread, messages: [...thread.messages, message] });
}

/**
 * Recomputes the summary fields and the outbox/scheduled mailboxes from the messages.
 * `add` files the thread in one more mailbox (Sent, when a message goes out).
 */
function rebuild(thread: Owned<Thread>, add?: StoredMailbox): Owned<Thread> {
	const { messages } = thread;
	const last = messages[messages.length - 1] as Message;
	const mailboxes = new Set<StoredMailbox>(
		thread.mailboxes.filter((m) => m !== 'outbox' && m !== 'scheduled')
	);
	if (add) mailboxes.add(add);
	for (const m of messages) {
		if (m.status === 'outbox' || m.status === 'scheduled') mailboxes.add(m.status);
	}
	const participants: Address[] = [];
	for (const m of messages) {
		if (!participants.some((p) => p.email === m.from.email)) participants.push(m.from);
	}
	return {
		...thread,
		snippet: last.snippet,
		participants,
		messageCount: messages.length,
		lastMessageAt: messages.reduce((max, m) => (m.sentAt > max ? m.sentAt : max), last.sentAt),
		mailboxes: STORED_MAILBOXES.filter((m) => mailboxes.has(m)),
		isUnread: messages.some((m) => !m.isRead),
		attachments: messages.flatMap((m) =>
			m.attachments.map(({ filename, mime }) => ({ filename, mime }))
		)
	};
}

function htmlToText(html: string): string {
	return new DOMParser().parseFromString(html, 'text/html').body.textContent ?? '';
}
