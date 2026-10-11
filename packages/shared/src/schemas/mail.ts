import { z } from 'zod';
import { AIInsightsSchema } from './ai';
import { AddressSchema, IdSchema, IsoDateTimeSchema } from './common';
import { CategorySchema, StoredMailboxSchema } from './mailbox';

/** Per-file attachment limit (FR-5.4). */
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export const AttachmentSchema = z.object({
	id: IdSchema,
	filename: z.string().min(1).max(255),
	mime: z.string().min(1),
	size: z.int().nonnegative().max(MAX_ATTACHMENT_BYTES)
});
export type Attachment = z.infer<typeof AttachmentSchema>;

export const MESSAGE_STATUSES = ['draft', 'scheduled', 'outbox', 'sent'] as const;
export const MessageStatusSchema = z.enum(MESSAGE_STATUSES);
export type MessageStatus = z.infer<typeof MessageStatusSchema>;

export const MessageSchema = z.object({
	id: IdSchema,
	threadId: IdSchema,
	from: AddressSchema,
	to: z.array(AddressSchema),
	cc: z.array(AddressSchema),
	bcc: z.array(AddressSchema),
	subject: z.string(),
	/** Untrusted HTML; sanitize before rendering (FR-4.3). Null for plain-text mail. */
	bodyHtml: z.string().nullable(),
	bodyText: z.string(),
	snippet: z.string(),
	sentAt: IsoDateTimeSchema,
	/** When an undo-send or scheduled message goes out; null once sent. */
	sendAt: IsoDateTimeSchema.nullable(),
	status: MessageStatusSchema,
	inReplyTo: IdSchema.nullable(),
	attachments: z.array(AttachmentSchema),
	isRead: z.boolean(),
	ai: AIInsightsSchema.optional()
});
export type Message = z.infer<typeof MessageSchema>;

/** One row in the mail list (FR-3.1), with the user's state for the thread. */
export const ThreadSummarySchema = z.object({
	id: IdSchema,
	subject: z.string(),
	snippet: z.string(),
	/** Senders in conversation order, for the "Ada, Grace (3)" line. */
	participants: z.array(AddressSchema).min(1),
	messageCount: z.int().positive(),
	lastMessageAt: IsoDateTimeSchema,
	mailboxes: z.array(StoredMailboxSchema),
	/** Inbox tab the thread belongs to; kept when archived. Null for spam and mail the user only sent. */
	category: CategorySchema.nullable(),
	labelIds: z.array(IdSchema),
	isUnread: z.boolean(),
	isStarred: z.boolean(),
	isImportant: z.boolean(),
	isMuted: z.boolean(),
	snoozedUntil: IsoDateTimeSchema.nullable(),
	/** Small previews for the row; the full list lives on the messages. */
	attachments: z.array(AttachmentSchema.pick({ filename: true, mime: true })),
	ai: AIInsightsSchema.optional()
});
export type ThreadSummary = z.infer<typeof ThreadSummarySchema>;

export const ThreadSchema = ThreadSummarySchema.extend({
	messages: z.array(MessageSchema).min(1)
});
export type Thread = z.infer<typeof ThreadSchema>;
