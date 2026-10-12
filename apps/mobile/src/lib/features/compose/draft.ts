import type { Attachment, ComposeMode, Draft } from '@nem/shared';
import { toAddresses, type Recipient } from './recipients.js';

/** Autosave waits this long after the last edit (FR-5.5). */
export const AUTOSAVE_MS = 3000;

/** What the user can edit in compose. */
export interface DraftFields {
	to: Recipient[];
	cc: Recipient[];
	bcc: Recipient[];
	subject: string;
	bodyHtml: string;
	attachments: Attachment[];
}

/** Where the draft belongs: its id and the message it answers, if any. */
export interface DraftMeta {
	id: string;
	mode: ComposeMode;
	threadId: string | null;
	inReplyTo: string | null;
}

/** A client-side id for a new draft. */
export function newDraftId(): string {
	return `draft-${crypto.randomUUID()}`;
}

/** Builds the draft to save. Invalid recipients are left out; they are still chips on screen. */
export function toDraft(fields: DraftFields, meta: DraftMeta, now = new Date()): Draft {
	return {
		...meta,
		to: toAddresses(fields.to),
		cc: toAddresses(fields.cc),
		bcc: toAddresses(fields.bcc),
		subject: fields.subject,
		bodyHtml: fields.bodyHtml,
		attachments: fields.attachments,
		scheduledAt: null,
		updatedAt: now.toISOString()
	};
}

/** A comparable key of the fields, so autosave runs only when something changed. */
export function draftKey(fields: DraftFields): string {
	const people = (list: Recipient[]) => list.map((r) => `${r.name ?? ''}<${r.email}>`);
	return JSON.stringify([
		people(fields.to),
		people(fields.cc),
		people(fields.bcc),
		fields.subject,
		fields.bodyHtml,
		fields.attachments.map((a) => a.id)
	]);
}
