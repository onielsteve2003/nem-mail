import { Capacitor } from '@capacitor/core';

const FADE_MS = 200;

/**
 * Hides the native launch screen once the app has painted its own splash, so the
 * hand-off is seamless (capacitor.config.ts turns off auto-hide). On the web the
 * in-app Splash component is the only splash, so this does nothing.
 */
export async function hideSplashScreen(): Promise<void> {
	if (!Capacitor.isNativePlatform()) return;
	const { SplashScreen } = await import('@capacitor/splash-screen');
	await SplashScreen.hide({ fadeOutDuration: FADE_MS });
}
