import {
	AppError,
	type Account,
	type SessionResponse,
	type SignInRequest,
	type SignUpRequest,
	type User
} from '@nem/shared';
import type { AuthRepository } from '../repositories.js';
import type { HttpClient } from './client.js';
import type { SessionTokens } from './session-tokens.js';

/**
 * Auth against the API. The server only knows one session per token; the device keeps the tokens
 * of every signed-in account (SessionTokens), so listing and switching accounts are local.
 */
export class HttpAuthRepository implements AuthRepository {
	readonly #http: HttpClient;
	readonly #tokens: SessionTokens;

	constructor(http: HttpClient, tokens: SessionTokens) {
		this.#http = http;
		this.#tokens = tokens;
	}

	/** @throws AppError CONFLICT when the email is taken. */
	async signUp(request: SignUpRequest): Promise<SessionResponse> {
		const session = await this.#http.call('signUp', { body: request });
		this.#tokens.add(session);
		return session;
	}

	/** @throws AppError UNAUTHORIZED when the email or password is wrong. */
	async signIn(request: SignInRequest): Promise<SessionResponse> {
		const session = await this.#http.call('signIn', { body: request });
		this.#tokens.add(session);
		return session;
	}

	/** Ends the server session; the token is forgotten even when the server cannot be reached. */
	async signOut(): Promise<void> {
		const userId = this.#tokens.activeId;
		if (!userId) return;
		try {
			await this.#http.call('signOut', { body: {} });
		} catch (error) {
			// An expired token is already signed out; other failures are reported after signing out here.
			if (!isUnauthorized(error)) throw error;
		} finally {
			this.#tokens.remove(userId);
		}
	}

	/** The signed-in user, or null when there is no valid token (a 401 drops it). */
	async me(): Promise<User | null> {
		if (!this.#tokens.token) return null;
		try {
			const user = await this.#http.call('me');
			this.#tokens.updateUser(user);
			return user;
		} catch (error) {
			if (isUnauthorized(error)) return null;
			throw error;
		}
	}

	async listAccounts(): Promise<Account[]> {
		return this.#tokens.accounts();
	}

	/** @throws AppError NOT_FOUND unless the account is signed in on this device. */
	async switchAccount(accountId: string): Promise<User> {
		this.#tokens.switchTo(accountId);
		const user = await this.me();
		if (!user) throw new AppError('UNAUTHORIZED', 'That account was signed out');
		return user;
	}
}

function isUnauthorized(error: unknown): boolean {
	return error instanceof AppError && error.code === 'UNAUTHORIZED';
}
