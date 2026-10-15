import {
	PASSWORD_MIN,
	SignInRequestSchema,
	SignUpRequestSchema,
	type SignInRequest,
	type SignUpRequest
} from '@nem/shared';
import { errorMessage, toAppError } from '#lib/utils/errors.js';

export type AuthMode = 'signIn' | 'signUp';

export interface AuthValues {
	name: string;
	email: string;
	password: string;
}

export type AuthFieldErrors = Partial<Record<keyof AuthValues, string>>;

export type AuthCheck =
	{ ok: true; request: SignUpRequest | SignInRequest } | { ok: false; errors: AuthFieldErrors };

const FIELD_ERRORS: Record<AuthMode, Required<AuthFieldErrors>> = {
	signUp: {
		name: 'Enter your name.',
		email: 'Enter a valid email address.',
		password: `Use at least ${PASSWORD_MIN} characters.`
	},
	signIn: {
		name: '',
		email: 'Enter a valid email address.',
		password: 'Enter your password.'
	}
};

/** Checks the form with the same schemas the API validates against, one message per field. */
export function checkAuthForm(mode: AuthMode, values: AuthValues): AuthCheck {
	const result =
		mode === 'signUp'
			? SignUpRequestSchema.safeParse(values)
			: SignInRequestSchema.safeParse({ email: values.email, password: values.password });
	if (result.success) return { ok: true, request: result.data };
	const errors: AuthFieldErrors = {};
	for (const issue of result.error.issues) {
		const field = issue.path[0] as keyof AuthValues;
		errors[field] ??= FIELD_ERRORS[mode][field];
	}
	return { ok: false, errors };
}

/** What to tell the user when the server turns the form down. */
export function authErrorMessage(mode: AuthMode, error: unknown): string {
	const { code } = toAppError(error);
	// The server does not say which part was wrong, so neither do we.
	if (code === 'UNAUTHORIZED' && mode === 'signIn') return 'Wrong email or password.';
	if (code === 'CONFLICT') return 'An account with that email already exists. Sign in instead.';
	return errorMessage(error);
}
