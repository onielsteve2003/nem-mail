import { Capacitor } from '@capacitor/core';

/**
 * Calls `onback` for the Android hardware back button in the native app.
 * On the web the browser's own back works, so this does nothing. Returns a stop function.
 */
export function listenBackButton(onback: () => void): () => void {
	if (!Capacitor.isNativePlatform()) return () => {};
	let stopped = false;
	let remove: (() => Promise<void>) | undefined;
	void import('@capacitor/app').then(async ({ App }) => {
		const handle = await App.addListener('backButton', onback);
		if (stopped) void handle.remove();
		else remove = handle.remove;
	});
	return () => {
		stopped = true;
		void remove?.();
	};
}

/** Leaves the native app (back on the home screen). */
export async function exitApp(): Promise<void> {
	if (!Capacitor.isNativePlatform()) return;
	const { App } = await import('@capacitor/app');
	await App.exitApp();
}
