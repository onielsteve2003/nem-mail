import { describe, expect, it, vi } from 'vitest';
import { AppError } from '@nem/shared';
import { HttpClient, type HttpClientOptions } from './client.js';

const BASE = 'https://api.example/api/v1';
const USER = {
	id: 'u1',
	email: 'ada@nemmail.example',
	name: 'Ada',
	avatarSeed: 'ada',
	createdAt: '2026-01-01T00:00:00.000Z'
};

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json', ...headers }
	});
}

function envelope(code: string, status: number, headers?: Record<string, string>): Response {
	return json({ error: { code, message: `${code} happened` } }, status, headers);
}

function client(responses: Array<Response | Error>, options: Partial<HttpClientOptions> = {}) {
	const fetch = vi.fn<typeof globalThis.fetch>(async () => {
		const next = responses.shift();
		if (!next) throw new Error('no more responses');
		if (next instanceof Error) throw next;
		return next;
	});
	const sleep = vi.fn(async () => {});
	const http = new HttpClient({ baseUrl: `${BASE}/`, fetch, sleep, ...options });
	return { http, fetch, sleep };
}

async function failure(promise: Promise<unknown>): Promise<AppError> {
	const error = await promise.then(
		() => null,
		(e: unknown) => e
	);
	expect(error).toBeInstanceOf(AppError);
	return error as AppError;
}

describe('HttpClient', () => {
	it('calls the endpoint with the bearer token and parses the response', async () => {
		const { http, fetch } = client([json(USER)], { token: () => 'secret' });
		await expect(http.call('me')).resolves.toEqual(USER);
		const [url, init] = fetch.mock.calls[0]!;
		expect(url).toBe(`${BASE}/me`);
		expect(init?.method).toBe('GET');
		expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer secret');
	});

	it('sends no Authorization header when signed out', async () => {
		const { http, fetch } = client([json(USER)]);
		await http.call('me');
		expect(fetch.mock.calls[0]![1]?.headers).not.toHaveProperty('Authorization');
	});

	it('fills path params and the query string, skipping unset values', async () => {
		const page = { items: [], nextCursor: null };
		const { http, fetch } = client([json(page), json({ ok: true })]);
		await http.call('listThreads', { query: { mailbox: 'inbox', category: undefined, limit: 20 } });
		await http.call('deleteLabel', { params: { id: 'a/b' } });
		expect(fetch.mock.calls[0]![0]).toBe(`${BASE}/threads?mailbox=inbox&limit=20`);
		expect(fetch.mock.calls[1]![0]).toBe(`${BASE}/labels/a%2Fb`);
	});

	it('sends JSON bodies, and FormData without overriding its Content-Type', async () => {
		const { http, fetch } = client([json({ ok: true }), new Response('x')]);
		await http.call('aiFeedback', { body: { type: 'open', threadId: 't1' } });
		const [, init] = fetch.mock.calls[0]!;
		expect(init?.body).toBe('{"type":"open","threadId":"t1"}');
		expect(init?.headers).toHaveProperty('Content-Type', 'application/json');

		const form = new FormData();
		await http.blob('uploadAttachment', { body: form });
		expect(fetch.mock.calls[1]![1]?.body).toBe(form);
		expect(fetch.mock.calls[1]![1]?.headers).not.toHaveProperty('Content-Type');
	});

	it('turns the error envelope into an AppError with the same code', async () => {
		const { http } = client([envelope('NOT_FOUND', 404)]);
		const error = await failure(http.call('getThread', { params: { id: 't9' } }));
		expect(error.code).toBe('NOT_FOUND');
		expect(error.message).toBe('NOT_FOUND happened');
	});

	it('maps a status without an envelope to a code', async () => {
		const { http } = client([new Response('<html>', { status: 403 })]);
		expect((await failure(http.call('me'))).code).toBe('FORBIDDEN');
	});

	it('reports a response that fails the schema as INTERNAL', async () => {
		const { http } = client([json({ id: 'u1' })]);
		const error = await failure(http.call('me'));
		expect(error.code).toBe('INTERNAL');
		expect(error.details).toMatchObject({ endpoint: 'me' });
	});

	it('calls onUnauthorized on 401 and does not retry it', async () => {
		const onUnauthorized = vi.fn();
		const { http, fetch } = client([envelope('UNAUTHORIZED', 401)], { onUnauthorized });
		expect((await failure(http.call('me'))).code).toBe('UNAUTHORIZED');
		expect(onUnauthorized).toHaveBeenCalledOnce();
		expect(fetch).toHaveBeenCalledOnce();
	});

	it('retries idempotent requests with doubling delays', async () => {
		const { http, fetch, sleep } = client([
			new TypeError('Failed to fetch'),
			new Response('Bad gateway', { status: 502 }),
			json(USER)
		]);
		await expect(http.call('me')).resolves.toEqual(USER);
		expect(fetch).toHaveBeenCalledTimes(3);
		expect(sleep.mock.calls).toEqual([[500], [1000]]);
	});

	it('gives up after the retry budget with the last error', async () => {
		const { http, fetch } = client([
			new TypeError('offline'),
			new TypeError('offline'),
			new TypeError('offline')
		]);
		expect((await failure(http.call('me'))).code).toBe('NETWORK');
		expect(fetch).toHaveBeenCalledTimes(3);
	});

	it('never retries a POST, which could act twice', async () => {
		const { http, fetch } = client([new TypeError('offline'), json({ ok: true })]);
		const error = await failure(
			http.call('send', { body: { draft: {} as never } }) as Promise<unknown>
		);
		expect(error.code).toBe('NETWORK');
		expect(fetch).toHaveBeenCalledOnce();
	});

	it('honors Retry-After when rate limited', async () => {
		const { http, sleep } = client([
			envelope('RATE_LIMITED', 429, { 'Retry-After': '3' }),
			json(USER)
		]);
		await http.call('me');
		expect(sleep).toHaveBeenCalledWith(3000);
	});

	it('does not retry 4xx errors', async () => {
		const { http, fetch } = client([envelope('VALIDATION_FAILED', 422)]);
		expect((await failure(http.call('me'))).code).toBe('VALIDATION_FAILED');
		expect(fetch).toHaveBeenCalledOnce();
	});

	it('fails with TIMEOUT when the server does not answer in time', async () => {
		const fetch = vi.fn<typeof globalThis.fetch>(
			(_url, init) =>
				new Promise((_resolve, reject) =>
					init?.signal?.addEventListener('abort', () => reject(new DOMException('', 'AbortError')))
				)
		);
		const http = new HttpClient({ baseUrl: BASE, fetch, timeoutMs: 5, retries: 0 });
		expect((await failure(http.call('me'))).code).toBe('TIMEOUT');
	});

	it('rethrows the caller abort untouched and does not retry', async () => {
		const controller = new AbortController();
		const fetch = vi.fn<typeof globalThis.fetch>(
			(_url, init) =>
				new Promise((_resolve, reject) =>
					init?.signal?.addEventListener('abort', () => reject(new DOMException('', 'AbortError')))
				)
		);
		const http = new HttpClient({ baseUrl: BASE, fetch });
		const pending = http.call('me', { signal: controller.signal });
		controller.abort();
		await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
		expect(fetch).toHaveBeenCalledOnce();
	});
});
