import { z } from 'zod';

/** Every failure the API (or the mock) can report. The UI picks its message by code. */
export const API_ERROR_CODES = [
	'BAD_REQUEST',
	'VALIDATION_FAILED',
	'UNAUTHORIZED',
	'FORBIDDEN',
	'NOT_FOUND',
	'CONFLICT',
	'PAYLOAD_TOO_LARGE',
	'RATE_LIMITED',
	'NETWORK',
	'TIMEOUT',
	'NOT_IMPLEMENTED',
	'INTERNAL'
] as const;
export const ApiErrorCodeSchema = z.enum(API_ERROR_CODES);
export type ApiErrorCode = z.infer<typeof ApiErrorCodeSchema>;

/** HTTP status per code. NETWORK and TIMEOUT never come from the server, so they map to 0. */
export const API_ERROR_STATUS: Record<ApiErrorCode, number> = {
	BAD_REQUEST: 400,
	VALIDATION_FAILED: 422,
	UNAUTHORIZED: 401,
	FORBIDDEN: 403,
	NOT_FOUND: 404,
	CONFLICT: 409,
	PAYLOAD_TOO_LARGE: 413,
	RATE_LIMITED: 429,
	NETWORK: 0,
	TIMEOUT: 0,
	NOT_IMPLEMENTED: 501,
	INTERNAL: 500
};

const RETRYABLE: readonly ApiErrorCode[] = ['NETWORK', 'TIMEOUT', 'RATE_LIMITED', 'INTERNAL'];

/** Error envelope: `{ error: { code, message, details? } }`. */
export const ApiErrorSchema = z.object({
	error: z.object({
		code: ApiErrorCodeSchema,
		message: z.string(),
		details: z.unknown().optional()
	})
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

/** What every repository throws, mock or HTTP, so callers handle one error type. */
export class AppError extends Error {
	readonly code: ApiErrorCode;
	readonly details: unknown;

	constructor(code: ApiErrorCode, message: string, details?: unknown) {
		super(message);
		this.name = 'AppError';
		this.code = code;
		this.details = details;
	}

	get status(): number {
		return API_ERROR_STATUS[this.code];
	}

	/** True when sending the same request again may succeed. */
	get retryable(): boolean {
		return RETRYABLE.includes(this.code);
	}

	toEnvelope(): ApiError {
		const error: ApiError['error'] = { code: this.code, message: this.message };
		if (this.details !== undefined) error.details = this.details;
		return { error };
	}

	static fromEnvelope(envelope: ApiError): AppError {
		return new AppError(envelope.error.code, envelope.error.message, envelope.error.details);
	}
}
