import { describe, expect, it, vi } from 'vitest';
import { isLowPower, watchLowPower } from './low-power.js';

function fakeBattery(level: number, charging: boolean) {
	return Object.assign(new EventTarget(), { level, charging });
}

describe('isLowPower', () => {
	it('is off with no signals', () => {
		expect(isLowPower({})).toBe(false);
	});

	it('turns on for a low battery only while unplugged', () => {
		expect(isLowPower({ battery: { level: 0.15, charging: false } })).toBe(true);
		expect(isLowPower({ battery: { level: 0.15, charging: true } })).toBe(false);
		expect(isLowPower({ battery: { level: 0.5, charging: false } })).toBe(false);
	});

	it('turns on for Data Saver and low-memory devices', () => {
		expect(isLowPower({ saveData: true })).toBe(true);
		expect(isLowPower({ deviceMemory: 2 })).toBe(true);
		expect(isLowPower({ deviceMemory: 8 })).toBe(false);
	});
});

describe('watchLowPower', () => {
	it('follows the battery and stops listening when stopped', async () => {
		const battery = fakeBattery(0.8, false);
		const root = document.createElement('div');
		const stop = watchLowPower(root, { getBattery: () => Promise.resolve(battery) });
		expect(root.dataset['lowPower']).toBe('false');

		battery.level = 0.1;
		await vi.waitFor(() => {
			battery.dispatchEvent(new Event('levelchange'));
			expect(root.dataset['lowPower']).toBe('true');
		});

		battery.charging = true;
		battery.dispatchEvent(new Event('chargingchange'));
		expect(root.dataset['lowPower']).toBe('false');

		stop();
		battery.charging = false;
		battery.dispatchEvent(new Event('chargingchange'));
		expect(root.dataset['lowPower']).toBe('false');
	});

	it('follows Data Saver changes and survives a missing Battery API', () => {
		const connection = Object.assign(new EventTarget(), { saveData: false });
		const root = document.createElement('div');
		watchLowPower(root, { connection });
		expect(root.dataset['lowPower']).toBe('false');

		connection.saveData = true;
		connection.dispatchEvent(new Event('change'));
		expect(root.dataset['lowPower']).toBe('true');
	});
});
