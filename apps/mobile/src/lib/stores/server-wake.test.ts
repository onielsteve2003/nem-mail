import { afterEach, describe, expect, it, vi } from 'vitest';
import { ServerWake } from './server-wake.svelte.js';

describe('ServerWake', () => {
	afterEach(() => vi.useRealTimers());

	it('says the server is waking, then offers the offline demo, then is awake', async () => {
		vi.useFakeTimers();
		const wake = new ServerWake({ wakingAfterMs: 1000, slowAfterMs: 5000 });
		let up = () => {};
		const running = wake.run(() => new Promise<void>((resolve) => (up = resolve)));
		expect(wake.status).toBe('checking');
		vi.advanceTimersByTime(1000);
		expect(wake.status).toBe('waking');
		vi.advanceTimersByTime(4000);
		expect(wake.status).toBe('slow');
		up();
		await running;
		expect(wake.status).toBe('awake');
	});

	it('goes straight to awake when the server answers at once', async () => {
		const wake = new ServerWake();
		await wake.run(async () => {});
		expect(wake.status).toBe('awake');
	});
});
