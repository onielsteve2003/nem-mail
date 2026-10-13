import { afterEach, describe, expect, it, vi } from 'vitest';
import { IDLE_TIMEOUT_MS, lazy } from './lazy.js';

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

describe('lazy', () => {
	it('loads once, on first ask, and shares the result', async () => {
		const load = vi.fn(async () => 'module');
		const mod = lazy(load);
		expect(load).not.toHaveBeenCalled();

		const [a, b] = await Promise.all([mod.get(), mod.get()]);
		expect(a).toBe('module');
		expect(b).toBe('module');
		expect(load).toHaveBeenCalledOnce();
	});

	it('prefetches when idle, falls back to a timer, and can be cancelled', () => {
		vi.useFakeTimers();
		vi.stubGlobal('requestIdleCallback', undefined);
		const load = vi.fn(async () => 'module');

		lazy(load).whenIdle();
		vi.advanceTimersByTime(IDLE_TIMEOUT_MS);
		expect(load).toHaveBeenCalledOnce();

		const other = vi.fn(async () => 'other');
		lazy(other).whenIdle()();
		vi.advanceTimersByTime(IDLE_TIMEOUT_MS);
		expect(other).not.toHaveBeenCalled();
	});
});
