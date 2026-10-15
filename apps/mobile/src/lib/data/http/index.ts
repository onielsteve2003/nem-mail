import { AppError, ENDPOINTS } from '@nem/shared';
import type { Repositories } from '../repositories.js';
import { HttpAuthRepository } from './auth.js';
import { HttpClient, type HttpClientOptions } from './client.js';
import { EventStreamClient } from './event-stream.js';
import {
	HttpAIRepository,
	HttpContactRepository,
	HttpDraftRepository,
	HttpLabelRepository,
	HttpMailRepository,
	HttpSearchRepository,
	HttpSettingsRepository
} from './repositories.js';
import { SessionTokens, type TokenStorage } from './session-tokens.js';

/**
 * A repository whose every method fails with NOT_IMPLEMENTED, for a data source that has no
 * implementation of it (mock mode runs AI on the device, not through a repository).
 */
export function notImplemented<T extends object>(name: string): T {
	return new Proxy({} as T, {
		get(_target, method) {
			if (typeof method !== 'string' || method === 'then') return undefined;
			return () =>
				Promise.reject(new AppError('NOT_IMPLEMENTED', `${name}.${method} is not implemented yet`));
		}
	});
}

export interface HttpRepositoryOptions extends Omit<HttpClientOptions, 'baseUrl' | 'token'> {
	/** Where the bearer tokens are kept; localStorage in the app, a fake in tests. */
	storage?: TokenStorage;
}

/** The Phase 2 repositories: every call goes to the API at `apiUrl` with the active token. */
export function createHttpRepositories(
	apiUrl: string,
	{ storage = browserStorage(), ...options }: HttpRepositoryOptions = {}
): Repositories {
	const tokens = new SessionTokens(storage);
	const onUnauthorized = () => {
		// The server no longer accepts this token (expired or signed out elsewhere).
		const userId = tokens.activeId;
		if (userId) tokens.remove(userId);
		options.onUnauthorized?.();
	};
	const http = new HttpClient({
		...options,
		baseUrl: apiUrl,
		token: () => tokens.token,
		onUnauthorized
	});
	const mail = new HttpMailRepository(http);
	mail.connectStream(
		new EventStreamClient({
			url: http.url(ENDPOINTS.events.path),
			token: () => tokens.token,
			fetch: options.fetch,
			onevent: (event) => mail.emit(event),
			onUnauthorized
		})
	);
	return {
		auth: new HttpAuthRepository(http, tokens, () => mail.sessionChanged()),
		mail,
		labels: new HttpLabelRepository(http),
		drafts: new HttpDraftRepository(http),
		contacts: new HttpContactRepository(http),
		settings: new HttpSettingsRepository(http),
		search: new HttpSearchRepository(http),
		ai: new HttpAIRepository(http)
	};
}

/** localStorage, or nothing where it is missing or blocked (tokens then last until reload). */
function browserStorage(): TokenStorage | undefined {
	try {
		return globalThis.localStorage;
	} catch {
		return undefined;
	}
}
