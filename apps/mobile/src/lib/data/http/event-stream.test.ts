import type { ServerEvent } from '@nem/shared';
import { describe, expect, it, vi } from 'vitest';
import { EventStreamClient } from './event-stream.js';

const COUNTS = { mailboxes: {}, categories: {}, labels: {} };
const URL = 'https://api.test/api/v1/events/stream';

/** A response whose body yields `chunks`, then stays open until aborted (or closes). */
function sse(chunks: string[], { close = false } = {}): Response {
	const encoder = new TextEncoder();
	const body = new ReadableStream<Uint8Array>({
		start(controller) {
			for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
			if (close) controller.close();
		}
	});
	return new Response(body, { headers: { 'Content-Type': 'text/event-stream' } });
}

function setup(responses: Array<() => Response>, token: string | null = 't1') {
	const events: ServerEvent[] = [];
	const onUnauthorized = vi.fn();
	const fetch = vi.fn<typeof globalThis.fetch>(async () => {
		const next = responses.shift();
		if (!next) return new Promise<Response>(() => {});
		return next();
	});
	const stream = new EventStreamClient({
		url: URL,
		token: () => token,
		fetch,
		onevent: (event) => events.push(event),
		onUnauthorized,
		retryDelayMs: 1
	});
	return { stream, events, fetch, onUnauthorized };
}

const headersOf = (fetch: ReturnType<typeof setup>['fetch'], call: number) =>
	fetch.mock.calls[call]?.[1]?.headers as Record<string, string>;

describe('EventStreamClient', () => {
	it('sends the bearer token and parses events split across chunks', async () => {
		const { stream, events, fetch } = setup([
			() =>
				sse([
					':connected\n\nretry: 1\n',
					`data:{"type":"counts",`,
					`"counts":${JSON.stringify(COUNTS)}}\n\n`,
					'id: 7\ndata: {"type":"unknown"}\n\n:heartbeat\n\n'
				])
		]);
		stream.start();
		await vi.waitFor(() => expect(events).toEqual([{ type: 'counts', counts: COUNTS }]));
		expect(fetch).toHaveBeenCalledOnce();
		expect(headersOf(fetch, 0)).toMatchObject({
			Authorization: 'Bearer t1',
			Accept: 'text/event-stream'
		});
		stream.stop();
	});

	it('reconnects after the server closes, resuming from the last event id', async () => {
		const { stream, events, fetch } = setup([
			() =>
				sse(['id: 41\ndata: {"type":"counts","counts":' + JSON.stringify(COUNTS) + '}\n\n'], {
					close: true
				}),
			() => new Response('down', { status: 503 }),
			() => sse([])
		]);
		stream.start();
		await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(3));
		expect(events).toHaveLength(1);
		expect(headersOf(fetch, 1)['Last-Event-ID']).toBe('41');
		expect(headersOf(fetch, 2)['Last-Event-ID']).toBe('41');
		stream.stop();
	});

	it('stops on 401 and reports it', async () => {
		const { stream, fetch, onUnauthorized } = setup([() => new Response('{}', { status: 401 })]);
		stream.start();
		await vi.waitFor(() => expect(onUnauthorized).toHaveBeenCalledOnce());
		await vi.waitFor(() => expect(stream.isRunning).toBe(false));
		expect(fetch).toHaveBeenCalledOnce();
	});

	it('does not connect without a token', async () => {
		const { stream, fetch } = setup([], null);
		stream.start();
		await vi.waitFor(() => expect(stream.isRunning).toBe(false));
		expect(fetch).not.toHaveBeenCalled();
	});

	it('restart opens a new stream and forgets the old event id', async () => {
		const { stream, fetch } = setup([() => sse(['id: 9\ndata: {}\n\n']), () => sse([])]);
		stream.start();
		stream.start();
		await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
		stream.restart();
		await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
		expect(headersOf(fetch, 1)['Last-Event-ID']).toBeUndefined();
		expect(fetch.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
		stream.stop();
	});
});
