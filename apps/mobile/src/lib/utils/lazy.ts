/** Longest wait for an idle moment before loading anyway. */
export const IDLE_TIMEOUT_MS = 2000;

/**
 * Loads a module once, on first ask. Lets a heavy component stay out of the
 * first route's bundle (T12.7) and still be ready before the user needs it.
 * A failed load (offline, new deploy) is tried again on the next ask.
 */
export function lazy<T>(load: () => Promise<T>): {
	get: () => Promise<T>;
	whenIdle: (onload?: (value: T) => void) => () => void;
} {
	let pending: Promise<T> | null = null;
	function get(): Promise<T> {
		pending ??= load().catch((error: unknown) => {
			pending = null;
			throw error;
		});
		return pending;
	}
	return {
		get,
		/** Starts loading once the browser is idle. Returns a cancel function. */
		whenIdle(onload) {
			// A prefetch that fails stays quiet; the next get() reports it.
			const start = () => void get().then(onload, () => {});
			if (typeof requestIdleCallback === 'function') {
				const handle = requestIdleCallback(start, { timeout: IDLE_TIMEOUT_MS });
				return () => cancelIdleCallback(handle);
			}
			// Safari has no requestIdleCallback.
			const handle = setTimeout(start, IDLE_TIMEOUT_MS / 2);
			return () => clearTimeout(handle);
		}
	};
}
