import { Capacitor } from '@capacitor/core';

// A short pulse; long buzzes feel like errors.
const TICK_MS = 10;

/**
 * A light haptic tick, e.g. when a swipe crosses its threshold. The native app uses the
 * Capacitor Haptics plugin (the Taptic Engine on iPhone); the web falls back to the
 * Vibration API where the browser has it (Android). iOS Safari has neither, so it stays silent.
 */
export function hapticTick(): void {
	if (Capacitor.isNativePlatform()) {
		void import('@capacitor/haptics')
			.then(({ Haptics, ImpactStyle }) => Haptics.impact({ style: ImpactStyle.Light }))
			// A missed tick is not worth an error toast; the gesture still works.
			.catch((error: unknown) => console.warn('Haptics failed', error));
		return;
	}
	if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
		navigator.vibrate(TICK_MS);
	}
}
