import { describe, expect, it, vi } from 'vitest';
import { waitForServer } from './wake.js';

describe('waitForServer', () => {
	it('pings /health until it answers 2xx', async () => {
		const fetch = vi
			.fn<typeof globalThis.fetch>()
			.mockRejectedValueOnce(new TypeError('Failed to fetch'))
			.mockResolvedValueOnce(new Response('', { status: 502 }))
			.mockResolvedValueOnce(new Response('{"status":"UP"}'));
		await waitForServer('https://api.test/api/v1', { fetch, intervalMs: 1 });
		expect(fetch).toHaveBeenCalledTimes(3);
		expect(fetch.mock.calls[0]?.[0]).toBe('https://api.test/api/v1/health');
	});

	it('stops when aborted', async () => {
		const controller = new AbortController();
		const fetch = vi.fn<typeof globalThis.fetch>(async () => {
			controller.abort(new Error('gave up'));
			throw new TypeError('Failed to fetch');
		});
		await expect(
			waitForServer('https://api.test', { fetch, signal: controller.signal, intervalMs: 1 })
		).rejects.toThrow('gave up');
	});
});
