import { z } from 'zod';
import { IdSchema, IsoDateTimeSchema } from '../schemas/common';
import { CategorySchema, StoredMailboxSchema, SystemMailboxSchema } from '../schemas/mailbox';

/** Bulk operations for `PATCH /threads` (FR-6). Each op carries only the payload it needs. */
export const ThreadOpSchema = z.discriminatedUnion('op', [
	z.object({ op: z.literal('markRead') }),
	z.object({ op: z.literal('markUnread') }),
	z.object({ op: z.literal('star') }),
	z.object({ op: z.literal('unstar') }),
	z.object({ op: z.literal('markImportant') }),
	z.object({ op: z.literal('markNotImportant') }),
	z.object({ op: z.literal('archive') }),
	z.object({ op: z.literal('trash') }),
	z.object({ op: z.literal('spam') }),
	z.object({ op: z.literal('notSpam') }),
	z.object({ op: z.literal('mute') }),
	z.object({ op: z.literal('unmute') }),
	/** Moves between the user-movable mailboxes, replacing whichever of them the thread was in. */
	z.object({ op: z.literal('move'), to: StoredMailboxSchema.extract(['inbox', 'spam', 'trash']) }),
	z.object({ op: z.literal('setCategory'), category: CategorySchema }),
	z.object({ op: z.literal('addLabels'), labelIds: z.array(IdSchema).min(1) }),
	z.object({ op: z.literal('removeLabels'), labelIds: z.array(IdSchema).min(1) }),
	z.object({ op: z.literal('snooze'), until: IsoDateTimeSchema }),
	z.object({ op: z.literal('unsnooze') })
]);
export type ThreadOp = z.infer<typeof ThreadOpSchema>;
export type ThreadOpName = ThreadOp['op'];

export const BULK_MAX = 500;

export const BulkThreadRequestSchema = z.object({
	ids: z.array(IdSchema).min(1).max(BULK_MAX),
	op: ThreadOpSchema
});
export type BulkThreadRequest = z.infer<typeof BulkThreadRequestSchema>;

/** The ids that changed; unknown ids are skipped rather than failing the batch. */
export const BulkThreadResponseSchema = z.object({ updatedIds: z.array(IdSchema) });
export type BulkThreadResponse = z.infer<typeof BulkThreadResponseSchema>;

/** The mailboxes whose threads can be deleted forever or emptied (FR-6.4). */
export const BinMailboxSchema = StoredMailboxSchema.extract(['spam', 'trash']);
export type BinMailbox = z.infer<typeof BinMailboxSchema>;

/** Deletes threads forever; only threads in Spam or Trash are deleted, others are skipped. */
export const DeleteThreadsRequestSchema = z.object({
	ids: z.array(IdSchema).min(1).max(BULK_MAX)
});
export type DeleteThreadsRequest = z.infer<typeof DeleteThreadsRequestSchema>;

/** Which list to show: a mailbox (optionally one inbox tab) or a label. */
export const ThreadListFilterSchema = z.union([
	z.object({ mailbox: SystemMailboxSchema, category: CategorySchema.optional() }),
	z.object({ labelId: IdSchema })
]);
export type ThreadListFilter = z.infer<typeof ThreadListFilterSchema>;
