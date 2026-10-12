import { AppError, type ApiErrorCode } from '@nem/shared';

/** Wraps anything thrown into an AppError, so stores handle one error type. */
export function toAppError(error: unknown): AppError {
	if (error instanceof AppError) return error;
	const message = error instanceof Error ? error.message : String(error);
	return new AppError('INTERNAL', message, error);
}

const MESSAGES: Partial<Record<ApiErrorCode, string>> = {
	NETWORK: "Can't connect right now. Check your connection.",
	TIMEOUT: 'That took too long. Try again.',
	UNAUTHORIZED: 'Please sign in again.',
	NOT_FOUND: 'That item no longer exists.',
	RATE_LIMITED: 'Too many requests. Wait a moment and try again.',
	NOT_IMPLEMENTED: "That isn't available yet."
};

/** Friendly copy for an error; validation and conflict errors keep their own message. */
export function errorMessage(error: unknown, fallback = 'Something went wrong.'): string {
	const appError = toAppError(error);
	if (appError.code === 'VALIDATION_FAILED' || appError.code === 'CONFLICT') {
		return appError.message;
	}
	return MESSAGES[appError.code] ?? fallback;
}

/** Title and message for the global error page (+error.svelte) by HTTP status. */
export function errorPageCopy(status: number): { title: string; message: string } {
	if (status === 404) {
		return {
			title: 'Page not found',
			message: "This page doesn't exist or has moved. Head back to your inbox."
		};
	}
	return {
		title: 'Something went wrong',
		message: 'This screen hit an error. Try again, or head back to your inbox.'
	};
}
