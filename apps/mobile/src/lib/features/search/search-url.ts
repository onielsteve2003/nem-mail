/** URL flag for semantic search mode (AI-7). */
export const SEMANTIC_PARAM = 'semantic';

/**
 * The search route URL for `query`, built from the current URL (keeps origin and base
 * path, and semantic mode when it is on).
 */
export function searchUrl(current: { href: string }, query: string): URL {
	const url = new URL(current.href);
	const isSemantic = url.searchParams.get(SEMANTIC_PARAM) === '1';
	const params = new URLSearchParams(query ? { q: query } : {});
	if (query && isSemantic) params.set(SEMANTIC_PARAM, '1');
	url.search = params.toString();
	return url;
}

/** The current search URL with semantic mode turned on or off. */
export function semanticUrl(current: { href: string }, isOn: boolean): URL {
	const url = new URL(current.href);
	if (isOn) url.searchParams.set(SEMANTIC_PARAM, '1');
	else url.searchParams.delete(SEMANTIC_PARAM);
	return url;
}
