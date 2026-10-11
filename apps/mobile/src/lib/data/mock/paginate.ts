import { AppError, PageQuerySchema, type Page, type PageQuery } from '@nem/shared';

/**
 * Keyset pagination over items sorted by `keyOf`, descending. The cursor holds
 * the last key served, so the next page stays correct when rows above it are
 * archived or deleted in between (offsets would skip rows).
 * @throws AppError BAD_REQUEST for a cursor this function did not make.
 */
export function paginate<T>(items: T[], page: PageQuery, keyOf: (item: T) => string): Page<T> {
	const { cursor, limit } = PageQuerySchema.parse(page);
	const after = cursor === undefined ? undefined : decodeCursor(cursor);
	const start = after === undefined ? 0 : items.findIndex((item) => keyOf(item) < after);
	const rest = start === -1 ? [] : items.slice(start);
	const pageItems = rest.slice(0, limit);
	const last = pageItems[pageItems.length - 1];
	return {
		items: pageItems,
		nextCursor: rest.length > limit && last ? encodeCursor(keyOf(last)) : null
	};
}

function encodeCursor(key: string): string {
	return btoa(encodeURIComponent(key));
}

function decodeCursor(cursor: string): string {
	try {
		return decodeURIComponent(atob(cursor));
	} catch {
		throw new AppError('BAD_REQUEST', 'Invalid cursor');
	}
}
