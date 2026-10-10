import { describe, expect, it, vi } from 'vitest';

const defineCustomElements = vi.fn(() => Promise.resolve());
vi.mock('@ionic/core/loader', () => ({ defineCustomElements }));

describe('setupIonic', () => {
	it('registers the Ionic elements once, however often it is called', async () => {
		const { setupIonic } = await import('./ionic.js');

		await setupIonic();
		await setupIonic();

		expect(defineCustomElements).toHaveBeenCalledTimes(1);
		expect(defineCustomElements).toHaveBeenCalledWith(window);
	});
});
