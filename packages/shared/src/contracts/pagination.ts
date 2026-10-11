import { z } from 'zod';

export const PAGE_LIMIT_DEFAULT = 50;
export const PAGE_LIMIT_MAX = 100;

/** Opaque to clients: pass back the `nextCursor` you were given, never build one. */
export const CursorSchema = z.string().min(1);
export type Cursor = z.infer<typeof CursorSchema>;

/** `?cursor=<opaque>&limit=50`. Limit is coerced because it arrives as a query string. */
export const PageQuerySchema = z.object({
	cursor: CursorSchema.optional(),
	limit: z.coerce.number().int().min(1).max(PAGE_LIMIT_MAX).default(PAGE_LIMIT_DEFAULT)
});
export type PageQuery = z.input<typeof PageQuerySchema>;

export function pageSchema<T extends z.ZodType>(item: T) {
	return z.object({ items: z.array(item), nextCursor: CursorSchema.nullable() });
}

/** One page of results; `nextCursor` is null on the last page. */
export interface Page<T> {
	items: T[];
	nextCursor: Cursor | null;
}
