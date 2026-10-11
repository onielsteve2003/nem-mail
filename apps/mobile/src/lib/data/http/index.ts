import { AppError } from '@nem/shared';
import type { Repositories } from '../repositories.js';

/**
 * A repository whose every method fails with NOT_IMPLEMENTED. Phase 2 (M19)
 * replaces these with real HTTP clients; until then `PUBLIC_DATA_SOURCE=api`
 * boots but every call reports the missing backend instead of crashing.
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

/** The Phase 2 HTTP repositories, stubbed until the API exists. */
export function createHttpRepositories(apiUrl: string): Repositories {
	const stub = <T extends object>(name: string) => notImplemented<T>(`${name} (${apiUrl})`);
	return {
		auth: stub('HttpAuthRepository'),
		mail: stub('HttpMailRepository'),
		labels: stub('HttpLabelRepository'),
		drafts: stub('HttpDraftRepository'),
		contacts: stub('HttpContactRepository'),
		settings: stub('HttpSettingsRepository'),
		search: stub('HttpSearchRepository'),
		ai: stub('HttpAIRepository')
	};
}
