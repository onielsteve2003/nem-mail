// Below this battery level (while unplugged) the app drops its ambient effects.
export const LOW_BATTERY_LEVEL = 0.2;
// Devices reporting this much RAM or less (GB) get the light visuals from the start.
const LOW_MEMORY_GB = 2;

interface BatteryLike extends EventTarget {
	level: number;
	charging: boolean;
}

interface PowerNavigator {
	getBattery?: () => Promise<BatteryLike>;
	connection?: EventTarget & { saveData?: boolean };
	deviceMemory?: number;
}

export interface PowerSignals {
	battery?: { level: number; charging: boolean } | undefined;
	saveData?: boolean | undefined;
	deviceMemory?: number | undefined;
}

/**
 * Low-power mode: a draining battery, the user's Data Saver, or a low-memory device.
 * Browsers expose no "Low Power Mode" flag (iOS Safari has no Battery API either), so
 * these are the signals there are; missing ones count as "not low".
 */
export function isLowPower({ battery, saveData, deviceMemory }: PowerSignals): boolean {
	if (battery && !battery.charging && battery.level <= LOW_BATTERY_LEVEL) return true;
	if (saveData) return true;
	return deviceMemory !== undefined && deviceMemory <= LOW_MEMORY_GB;
}

/**
 * Keeps `data-low-power="true|false"` on `root` up to date. In low-power mode global.css
 * and the ambient components stop their decorative loops (aurora drift, AI orb glow,
 * skeleton shimmer) and drop backdrop blur; spinners, progress bars and the splash pulse
 * keep moving because they carry meaning. Returns a stop function.
 */
export function watchLowPower(
	root: HTMLElement,
	// Battery, Data Saver and device memory are not in the DOM typings yet.
	nav: PowerNavigator = navigator as PowerNavigator
): () => void {
	const signals: PowerSignals = { deviceMemory: nav.deviceMemory };
	const update = () => {
		signals.saveData = nav.connection?.saveData;
		root.dataset['lowPower'] = String(isLowPower(signals));
	};
	update();

	const connection = nav.connection;
	connection?.addEventListener('change', update);

	let stopped = false;
	let battery: BatteryLike | undefined;
	const onBattery = () => {
		if (!battery) return;
		signals.battery = { level: battery.level, charging: battery.charging };
		update();
	};
	nav
		.getBattery?.()
		.then((found) => {
			if (stopped) return;
			battery = found;
			battery.addEventListener('levelchange', onBattery);
			battery.addEventListener('chargingchange', onBattery);
			onBattery();
		})
		// Blocked by a permissions policy or unsupported: stay on the other signals.
		.catch(() => {});

	return () => {
		stopped = true;
		connection?.removeEventListener('change', update);
		battery?.removeEventListener('levelchange', onBattery);
		battery?.removeEventListener('chargingchange', onBattery);
	};
}
