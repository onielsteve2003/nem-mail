import { ServerEventSchema, type ServerEvent } from '@nem/shared';

export interface EventStreamOptions {
	/** Absolute URL of `/events/stream`. */
	url: string;
	/** The current bearer token; no token means no stream until `restart`. */
	token: () => string | null;
	onevent: (event: ServerEvent) => void;
	/** Called when the server rejects the token; the stream then waits for `restart`. */
	onUnauthorized?: () => void;
	fetch?: typeof fetch;
	/** First reconnect delay; it doubles up to `maxDelayMs`. The server's `retry:` overrides it. */
	retryDelayMs?: number;
	maxDelayMs?: number;
}

const RETRY_DELAY_MS = 1000;
const MAX_DELAY_MS = 30_000;

/**
 * The realtime stream (T17.3) read with fetch, because EventSource cannot send the bearer header.
 * Reconnects with backoff and `Last-Event-ID`, so the server replays what was missed; each
 * connect also starts with fresh counts.
 */
export class EventStreamClient {
	readonly #options: EventStreamOptions;
	readonly #fetch: typeof fetch;
	#controller: AbortController | null = null;
	#lastEventId: string | null = null;
	#retryDelayMs: number;

	constructor(options: EventStreamOptions) {
		this.#options = options;
		this.#fetch = options.fetch ?? globalThis.fetch.bind(globalThis);
		this.#retryDelayMs = options.retryDelayMs ?? RETRY_DELAY_MS;
	}

	get isRunning(): boolean {
		return this.#controller !== null;
	}

	/** Opens the stream unless it is already open. */
	start(): void {
		if (this.#controller) return;
		const controller = new AbortController();
		this.#controller = controller;
		void this.#run(controller.signal).finally(() => {
			if (this.#controller === controller) this.#controller = null;
		});
	}

	stop(): void {
		this.#controller?.abort();
		this.#controller = null;
	}

	/** Reconnects from scratch, e.g. for another account. */
	restart(): void {
		this.stop();
		this.#lastEventId = null;
		this.start();
	}

	async #run(signal: AbortSignal): Promise<void> {
		const maxDelay = this.#options.maxDelayMs ?? MAX_DELAY_MS;
		let failures = 0;
		while (!signal.aborted) {
			const token = this.#options.token();
			if (!token) return;
			try {
				const headers: Record<string, string> = {
					Accept: 'text/event-stream',
					Authorization: `Bearer ${token}`
				};
				if (this.#lastEventId) headers['Last-Event-ID'] = this.#lastEventId;
				const response = await this.#fetch(this.#options.url, { headers, signal });
				if (response.status === 401) {
					await response.body?.cancel();
					this.#options.onUnauthorized?.();
					return;
				}
				if (response.ok && response.body) {
					failures = 0;
					await this.#read(response.body, signal);
				} else {
					await response.body?.cancel();
				}
			} catch {
				// Network drop or server restart: try again below.
			}
			if (signal.aborted) return;
			await wait(Math.min(this.#retryDelayMs * 2 ** failures, maxDelay), signal);
			failures++;
		}
	}

	/** Parses `text/event-stream` until the server closes it. */
	async #read(body: ReadableStream<Uint8Array>, signal: AbortSignal): Promise<void> {
		const reader = body.getReader();
		const decoder = new TextDecoder();
		const stop = () => void reader.cancel().catch(() => {});
		signal.addEventListener('abort', stop, { once: true });
		let buffer = '';
		let data: string[] = [];
		let id: string | null = null;
		try {
			for (;;) {
				const { done, value } = await reader.read();
				if (done) return;
				buffer += decoder.decode(value, { stream: true });
				const lines = buffer.split(/\r\n|\r|\n/);
				buffer = lines.pop() ?? '';
				for (const line of lines) {
					if (line === '') {
						if (id !== null) this.#lastEventId = id;
						if (data.length > 0) this.#dispatch(data.join('\n'));
						data = [];
						id = null;
						continue;
					}
					if (line.startsWith(':')) continue;
					const colon = line.indexOf(':');
					const field = colon === -1 ? line : line.slice(0, colon);
					const value = colon === -1 ? '' : line.slice(colon + 1).replace(/^ /, '');
					if (field === 'data') data.push(value);
					else if (field === 'id') id = value;
					else if (field === 'retry' && /^\d+$/.test(value)) this.#retryDelayMs = Number(value);
				}
			}
		} finally {
			signal.removeEventListener('abort', stop);
		}
	}

	#dispatch(text: string): void {
		let json: unknown;
		try {
			json = JSON.parse(text);
		} catch {
			return;
		}
		// Events of a newer server than this app knows about are skipped.
		const parsed = ServerEventSchema.safeParse(json);
		if (parsed.success) this.#options.onevent(parsed.data);
	}
}

function wait(ms: number, signal: AbortSignal): Promise<void> {
	return new Promise((resolve) => {
		const timer = setTimeout(done, ms);
		signal.addEventListener('abort', done, { once: true });
		function done() {
			clearTimeout(timer);
			signal.removeEventListener('abort', done);
			resolve();
		}
	});
}
