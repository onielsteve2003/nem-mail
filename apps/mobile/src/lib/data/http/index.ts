import { AppError, ENDPOINTS } from '@nem/shared';
import type { Repositories } from '../repositories.js';
import { HttpAuthRepository } from './auth.js';
import { HttpClient, type HttpClientOptions } from './client.js';
import { EventStreamClient } from './event-stream.js';
import { OfflineQueue } from './offline-queue.js';
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
	options?: HttpRepositoryOptions
): Repositories {
	return createHttpBackend(apiUrl, options).repos;
}

export interface HttpBackend {
	repos: Repositories;
	/** Changes made offline, waiting to be replayed. */
	queue: OfflineQueue;
}

/** The repositories plus the offline queue behind them. */
export function createHttpBackend(
	apiUrl: string,
	{ storage = browserStorage(), ...options }: HttpRepositoryOptions = {}
): HttpBackend {
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
	const queue = new OfflineQueue({ http, storage, userId: () => tokens.activeId });
	const mail = new HttpMailRepository(http, queue);
	mail.connectStream(
		new EventStreamClient({
			url: http.url(ENDPOINTS.events.path),
			token: () => tokens.token,
			fetch: options.fetch,
			onevent: (event) => mail.emit(event),
			onUnauthorized
		})
	);
	const repos: Repositories = {
		auth: new HttpAuthRepository(http, tokens, () => {
			mail.sessionChanged();
			// Changes another account queued go out once it is active again.
			void queue.flush();
		}),
		mail,
		labels: new HttpLabelRepository(http),
		drafts: new HttpDraftRepository(http, queue),
		contacts: new HttpContactRepository(http),
		settings: new HttpSettingsRepository(http, queue),
		search: new HttpSearchRepository(http),
		ai: new HttpAIRepository(http, queue)
	};
	return { repos, queue };
}

/** localStorage, or nothing where it is missing or blocked (tokens then last until reload). */
function browserStorage(): TokenStorage | undefined {
	try {
		return globalThis.localStorage;
	} catch {
		return undefined;
	}
}
