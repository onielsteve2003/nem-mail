// A short pulse; long buzzes feel like errors.
const TICK_MS = 10;

/**
 * A light haptic tick, e.g. when a swipe crosses its threshold. Uses the Vibration
 * API where the browser has it (Android); T12.2 swaps in the Capacitor Haptics plugin.
 */
export function hapticTick(): void {
	if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
		navigator.vibrate(TICK_MS);
	}
}
