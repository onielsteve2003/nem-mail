export interface WakeOptions {
	fetch?: typeof fetch;
	signal?: AbortSignal;
	/** Pause between pings. */
	intervalMs?: number;
	/** How long one ping may take; a cold start can hold the first one for most of a minute. */
	pingTimeoutMs?: number;
}

/**
 * Waits until `GET {apiUrl}/health` answers 2xx. The free API host sleeps when idle and takes up to
 * about a minute to start (PRD §11), so this keeps pinging until it is up or `signal` aborts.
 * @throws the abort reason when `signal` aborts.
 */
export async function waitForServer(
	apiUrl: string,
	{
		fetch = globalThis.fetch.bind(globalThis),
		signal,
		intervalMs = 2000,
		pingTimeoutMs = 60_000
	}: WakeOptions = {}
): Promise<void> {
	for (;;) {
		signal?.throwIfAborted();
		try {
			const response = await fetch(`${apiUrl}/health`, {
				signal: pingSignal(pingTimeoutMs, signal),
				cache: 'no-store'
			});
			await response.body?.cancel();
			if (response.ok) return;
		} catch {
			// Not up yet (or offline): ping again.
		}
		signal?.throwIfAborted();
		await new Promise((resolve) => setTimeout(resolve, intervalMs));
	}
}

/** The ping's own timeout joined with the caller's signal (AbortSignal.any is iOS 17.4+). */
function pingSignal(timeoutMs: number, signal: AbortSignal | undefined): AbortSignal {
	const timeout = AbortSignal.timeout(timeoutMs);
	if (!signal) return timeout;
	return typeof AbortSignal.any === 'function' ? AbortSignal.any([signal, timeout]) : signal;
}
