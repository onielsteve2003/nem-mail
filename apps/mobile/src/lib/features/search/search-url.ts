/** The search route URL for `query`, built from the current URL (keeps origin and base path). */
export function searchUrl(current: { href: string }, query: string): URL {
	const url = new URL(current.href);
	url.search = query ? new URLSearchParams({ q: query }).toString() : '';
	return url;
}
