import { z } from 'zod';

/** System mailboxes in drawer order (FR-2.1). */
export const SYSTEM_MAILBOXES = [
	'inbox',
	'starred',
	'snoozed',
	'important',
	'sent',
	'scheduled',
	'outbox',
	'drafts',
	'all',
	'spam',
	'trash'
] as const;
export const SystemMailboxSchema = z.enum(SYSTEM_MAILBOXES);
export type SystemMailbox = z.infer<typeof SystemMailboxSchema>;

/**
 * Mailboxes a thread is actually filed in. The others are views over flags:
 * starred, important and snoozed read thread flags, and "all" is everything
 * except spam and trash. An archived thread is filed nowhere.
 */
export const STORED_MAILBOXES = [
	'inbox',
	'sent',
	'scheduled',
	'outbox',
	'drafts',
	'spam',
	'trash'
] as const satisfies readonly SystemMailbox[];
export const StoredMailboxSchema = z.enum(STORED_MAILBOXES);
export type StoredMailbox = z.infer<typeof StoredMailboxSchema>;

/** Inbox tabs (FR-2.2). ML assigns them. */
export const CATEGORIES = ['primary', 'promotions', 'social', 'updates', 'forums'] as const;
export const CategorySchema = z.enum(CATEGORIES);
export type Category = z.infer<typeof CategorySchema>;
