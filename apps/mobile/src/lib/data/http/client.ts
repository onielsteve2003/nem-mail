import type { z } from 'zod';
import {
	ApiErrorSchema,
	AppError,
	ENDPOINTS,
	buildPath,
	type ApiErrorCode,
	type EndpointName,
	type HttpMethod
} from '@nem/shared';

/** A request that has not answered by then fails with TIMEOUT. */
export const DEFAULT_TIMEOUT_MS = 15_000;
/** Extra attempts after the first, for retryable failures of idempotent requests. */
export const DEFAULT_RETRIES = 2;
/** First retry delay; it doubles each attempt. */
export const DEFAULT_RETRY_DELAY_MS = 500;
/** Longest wait a server's Retry-After can ask for before we give up instead. */
const MAX_RETRY_AFTER_MS = 10_000;

// POST is not idempotent: retrying a send or sign-up could do it twice.
const IDEMPOTENT: readonly HttpMethod[] = ['GET', 'PUT', 'DELETE'];

const STATUS_CODES: Record<number, ApiErrorCode> = {
	400: 'BAD_REQUEST',
	401: 'UNAUTHORIZED',
	403: 'FORBIDDEN',
	404: 'NOT_FOUND',
	409: 'CONFLICT',
	413: 'PAYLOAD_TOO_LARGE',
	422: 'VALIDATION_FAILED',
	429: 'RATE_LIMITED',
	501: 'NOT_IMPLEMENTED'
};

type Endpoint<N extends EndpointName> = (typeof ENDPOINTS)[N];
type QueryOf<E> = E extends { query: z.ZodType } ? z.input<E['query']> : never;
type BodyOf<E> = E extends { body: z.ZodType } ? z.input<E['body']> : never;

/** What an endpoint resolves to once its response passed the shared Zod schema. */
export type ResponseOf<N extends EndpointName> = z.output<Endpoint<N>['response']>;

export interface CallOptions<N extends EndpointName> {
	/** Values for `:param` path segments. */
	params?: Record<string, string>;
	query?: QueryOf<Endpoint<N>>;
	/** JSON body, or FormData for the multipart attachment upload. */
	body?: BodyOf<Endpoint<N>> | FormData;
	signal?: AbortSignal;
}

export interface HttpClientOptions {
	/** API root including `/api/v1`, without a trailing slash (`PUBLIC_API_URL`). */
	baseUrl: string;
	/** The current bearer token, read on every request so account switches apply at once. */
	token?: () => string | null;
	/** Called when the server rejects the token, so the session can be dropped. */
	onUnauthorized?: () => void;
	fetch?: typeof fetch;
	timeoutMs?: number;
	retries?: number;
	retryDelayMs?: number;
	/** Waits between retries; tests pass an instant one. */
	sleep?: (ms: number) => Promise<void>;
}

/**
 * The one way the app talks to the API: adds the bearer token, turns the error envelope (or a
 * network failure, timeout or odd response) into an AppError, validates every response with the
 * shared Zod schema, and retries idempotent requests that failed for a retryable reason.
 */
export class HttpClient {
	readonly #baseUrl: string;
	readonly #token: () => string | null;
	readonly #onUnauthorized: () => void;
	readonly #fetch: typeof fetch;
	readonly #timeoutMs: number;
	readonly #retries: number;
	readonly #retryDelayMs: number;
	readonly #sleep: (ms: number) => Promise<void>;

	constructor(options: HttpClientOptions) {
		this.#baseUrl = options.baseUrl.replace(/\/+$/, '');
		this.#token = options.token ?? (() => null);
		this.#onUnauthorized = options.onUnauthorized ?? (() => {});
		// Bound, because calling a detached window.fetch throws "Illegal invocation".
		this.#fetch = options.fetch ?? globalThis.fetch.bind(globalThis);
		this.#timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
		this.#retries = options.retries ?? DEFAULT_RETRIES;
		this.#retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
		this.#sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
	}

	/**
	 * Calls a JSON endpoint from the shared endpoint map and returns its parsed response.
	 * @throws AppError with the server's code, or NETWORK, TIMEOUT, or INTERNAL for a bad response.
	 */
	async call<N extends EndpointName>(
		name: N,
		options: CallOptions<N> = {}
	): Promise<ResponseOf<N>> {
		const endpoint: Endpoint<N> = ENDPOINTS[name];
		const response = await this.#send(endpoint.method, endpoint.path, options);
		const json: unknown = response.status === 204 ? {} : await readJson(response);
		const parsed = endpoint.response.safeParse(json);
		if (!parsed.success) {
			throw new AppError('INTERNAL', 'The server sent an unexpected response', {
				endpoint: name,
				issues: parsed.error.issues
			});
		}
		return parsed.data as ResponseOf<N>;
	}

	/** Calls an endpoint that answers with a file (attachment download). */
	async blob<N extends EndpointName>(name: N, options: CallOptions<N> = {}): Promise<Blob> {
		const endpoint: Endpoint<N> = ENDPOINTS[name];
		const response = await this.#send(endpoint.method, endpoint.path, options);
		return response.blob();
	}

	/** Absolute URL for a path, e.g. for the SSE stream, which EventSource opens itself. */
	url(path: string, params?: Record<string, string>): string {
		return this.#baseUrl + buildPath(path, params);
	}

	async #send(
		method: HttpMethod,
		path: string,
		options: CallOptions<EndpointName>
	): Promise<Response> {
		const url = this.url(path, options.params) + queryString(options.query);
		const attempts = 1 + (IDEMPOTENT.includes(method) ? this.#retries : 0);
		for (let attempt = 1; ; attempt++) {
			try {
				return await this.#attempt(method, url, options);
			} catch (error) {
				const retryIn = error instanceof AppError ? this.#retryDelay(error, attempt) : null;
				if (attempt >= attempts || retryIn === null || options.signal?.aborted) throw error;
				await this.#sleep(retryIn);
			}
		}
	}

	async #attempt(
		method: HttpMethod,
		url: string,
		{ body, signal }: CallOptions<EndpointName>
	): Promise<Response> {
		const headers: Record<string, string> = { Accept: 'application/json' };
		const token = this.#token();
		if (token) headers.Authorization = `Bearer ${token}`;
		// FormData sets its own multipart Content-Type with the boundary.
		const isForm = body instanceof FormData;
		if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json';

		const controller = new AbortController();
		let isTimedOut = false;
		const timer = setTimeout(() => {
			isTimedOut = true;
			controller.abort();
		}, this.#timeoutMs);
		const forwardAbort = () => controller.abort(signal?.reason);
		if (signal?.aborted) forwardAbort();
		signal?.addEventListener('abort', forwardAbort, { once: true });

		let response: Response;
		try {
			response = await this.#fetch(url, {
				method,
				headers,
				body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
				signal: controller.signal
			});
		} catch (error) {
			// The caller's own abort is not a failure to report; rethrow it untouched.
			if (signal?.aborted) throw error;
			if (isTimedOut) throw new AppError('TIMEOUT', 'The server took too long to answer');
			throw new AppError('NETWORK', 'Could not reach the server', { cause: String(error) });
		} finally {
			clearTimeout(timer);
			signal?.removeEventListener('abort', forwardAbort);
		}

		if (response.ok) return response;
		const error = await toAppError(response);
		if (error.code === 'UNAUTHORIZED') this.#onUnauthorized();
		throw error;
	}

	/** Milliseconds to wait before retrying, or null when this error is not worth a retry. */
	#retryDelay(error: AppError, attempt: number): number | null {
		if (!error.retryable) return null;
		const retryAfter = (error.details as { retryAfterMs?: number } | undefined)?.retryAfterMs;
		if (retryAfter !== undefined) return retryAfter <= MAX_RETRY_AFTER_MS ? retryAfter : null;
		return this.#retryDelayMs * 2 ** (attempt - 1);
	}
}

/** Builds the query string, leaving out unset values. */
function queryString(query: object | undefined): string {
	if (!query) return '';
	const search = new URLSearchParams();
	for (const [key, value] of Object.entries(query)) {
		if (value !== undefined && value !== null) search.set(key, String(value));
	}
	const text = search.toString();
	return text ? `?${text}` : '';
}

async function readJson(response: Response): Promise<unknown> {
	try {
		return await response.json();
	} catch {
		throw new AppError('INTERNAL', 'The server sent a response that is not JSON');
	}
}

/** Reads the error envelope; a proxy or a sleeping host may answer with HTML instead. */
async function toAppError(response: Response): Promise<AppError> {
	let body: unknown;
	try {
		body = await response.json();
	} catch {
		body = undefined;
	}
	const envelope = ApiErrorSchema.safeParse(body);
	const error = envelope.success
		? AppError.fromEnvelope(envelope.data)
		: new AppError(
				STATUS_CODES[response.status] ?? (response.status >= 500 ? 'INTERNAL' : 'BAD_REQUEST'),
				`The server answered ${response.status}`
			);
	const retryAfter = Number(response.headers.get('Retry-After'));
	if (error.code === 'RATE_LIMITED' && retryAfter > 0) {
		return new AppError(error.code, error.message, {
			...(isRecord(error.details) ? error.details : {}),
			retryAfterMs: retryAfter * 1000
		});
	}
	return error;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}
