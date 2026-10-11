import { describe, expect, it } from 'vitest';
import {
	ApiErrorSchema,
	AppError,
	BulkThreadRequestSchema,
	buildPath,
	ENDPOINTS,
	PAGE_LIMIT_DEFAULT,
	PageQuerySchema,
	SearchQuerySchema,
	ThreadListQuerySchema
} from './index';

describe('pagination', () => {
	it('defaults and coerces the limit, and caps it', () => {
		expect(PageQuerySchema.parse({})).toEqual({ limit: PAGE_LIMIT_DEFAULT });
		expect(PageQuerySchema.parse({ cursor: 'abc', limit: '20' })).toEqual({
			cursor: 'abc',
			limit: 20
		});
		expect(PageQuerySchema.safeParse({ limit: 101 }).success).toBe(false);
	});
});

describe('errors', () => {
	it('round-trips an AppError through the envelope', () => {
		const error = new AppError('NOT_FOUND', 'No such thread', { id: 't9' });
		const envelope = ApiErrorSchema.parse(error.toEnvelope());
		expect(envelope).toEqual({
			error: { code: 'NOT_FOUND', message: 'No such thread', details: { id: 't9' } }
		});
		const back = AppError.fromEnvelope(envelope);
		expect(back).toBeInstanceOf(Error);
		expect([back.code, back.status, back.retryable]).toEqual(['NOT_FOUND', 404, false]);
		expect(new AppError('NETWORK', 'Offline').retryable).toBe(true);
	});

	it('rejects an unknown error code', () => {
		expect(ApiErrorSchema.safeParse({ error: { code: 'OOPS', message: '' } }).success).toBe(false);
	});
});

describe('thread contracts', () => {
	it('needs exactly one of mailbox or label', () => {
		expect(ThreadListQuerySchema.safeParse({ mailbox: 'inbox', category: 'social' }).success).toBe(
			true
		);
		expect(ThreadListQuerySchema.safeParse({ label: 'l1' }).success).toBe(true);
		expect(ThreadListQuerySchema.safeParse({}).success).toBe(false);
		expect(ThreadListQuerySchema.safeParse({ mailbox: 'inbox', label: 'l1' }).success).toBe(false);
	});

	it('checks each bulk op payload', () => {
		const ok = (op: unknown) => BulkThreadRequestSchema.safeParse({ ids: ['t1'], op }).success;
		expect(ok({ op: 'star' })).toBe(true);
		expect(ok({ op: 'move', to: 'trash' })).toBe(true);
		expect(ok({ op: 'move', to: 'sent' })).toBe(false);
		expect(ok({ op: 'addLabels', labelIds: [] })).toBe(false);
		expect(ok({ op: 'snooze', until: 'tomorrow' })).toBe(false);
		expect(BulkThreadRequestSchema.safeParse({ ids: [], op: { op: 'star' } }).success).toBe(false);
	});
});

describe('endpoints', () => {
	it('parses the semantic flag from a query string', () => {
		expect(SearchQuerySchema.parse({ q: ' invoice ', semantic: 'true' })).toMatchObject({
			q: 'invoice',
			semantic: true
		});
		expect(SearchQuerySchema.parse({ q: 'x', semantic: 'false' }).semantic).toBe(false);
	});

	it('builds paths with encoded params', () => {
		expect(buildPath(ENDPOINTS.getThread.path, { id: 'a/b' })).toBe('/threads/a%2Fb');
		expect(() => buildPath(ENDPOINTS.getThread.path)).toThrow('Missing path param "id"');
	});

	it('gives every endpoint a unique method and path', () => {
		const keys = Object.values(ENDPOINTS).map((e) => `${e.method} ${e.path}`);
		expect(new Set(keys).size).toBe(keys.length);
	});
});
