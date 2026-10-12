/** Wide screens show the list and a reading pane side by side (PRD §7 Responsiveness). */
export const TWO_PANE_QUERY = '(min-width: 900px)';

/** Search param holding the thread open in the reading pane. */
export const READING_PARAM = 'thread';

/** The parts of a URL these helpers read (page.url's searchParams is read-only). */
type UrlLike = { pathname: string; searchParams: Pick<URLSearchParams, 'get' | 'toString'> };

/** The thread open in the reading pane, or null. */
export function readingThreadId(url: UrlLike): string | null {
	return url.searchParams.get(READING_PARAM) || null;
}

/** Path + search of `url` with the reading pane showing `threadId`, or closed when null. */
export function withReadingThread(url: UrlLike, threadId: string | null): string {
	const params = new URLSearchParams(url.searchParams.toString());
	if (threadId) params.set(READING_PARAM, threadId);
	else params.delete(READING_PARAM);
	const search = params.toString();
	return search ? `${url.pathname}?${search}` : url.pathname;
}
