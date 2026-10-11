import { z } from 'zod';
import { AddressSchema, IdSchema, IsoDateTimeSchema } from './common';
import { AttachmentSchema } from './mail';

export const COMPOSE_MODES = ['new', 'reply', 'replyAll', 'forward'] as const;
export const ComposeModeSchema = z.enum(COMPOSE_MODES);
export type ComposeMode = z.infer<typeof ComposeModeSchema>;

export const DraftSchema = z.object({
	id: IdSchema,
	mode: ComposeModeSchema,
	/** The thread being replied to or forwarded; null for a new message. */
	threadId: IdSchema.nullable(),
	inReplyTo: IdSchema.nullable(),
	to: z.array(AddressSchema),
	cc: z.array(AddressSchema),
	bcc: z.array(AddressSchema),
	subject: z.string(),
	bodyHtml: z.string(),
	attachments: z.array(AttachmentSchema),
	/** Set when the user picked "Schedule send". */
	scheduledAt: IsoDateTimeSchema.nullable(),
	updatedAt: IsoDateTimeSchema
});
export type Draft = z.infer<typeof DraftSchema>;
