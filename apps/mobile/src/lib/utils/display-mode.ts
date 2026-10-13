import { Capacitor } from '@capacitor/core';

/** How the app is running: the Capacitor app, installed from the home screen, or in a browser tab. */
export type DisplayMode = 'native' | 'standalone' | 'browser';

interface DisplayEnvironment {
	isNative: boolean;
	matchMedia: ((query: string) => { matches: boolean }) | null;
	/** iOS Safari's own flag for home-screen apps; older iOS lacks the display-mode query. */
	isIosStandalone: boolean;
}

function browserEnvironment(): DisplayEnvironment {
	return {
		isNative: Capacitor.isNativePlatform(),
		matchMedia:
			typeof window.matchMedia === 'function' ? (query) => window.matchMedia(query) : null,
		isIosStandalone: (navigator as Navigator & { standalone?: boolean }).standalone === true
	};
}

/** Works out the display mode, e.g. to make the installed app feel native. */
export function displayMode(env: DisplayEnvironment = browserEnvironment()): DisplayMode {
	if (env.isNative) return 'native';
	const isStandalone =
		env.isIosStandalone ||
		(env.matchMedia?.('(display-mode: standalone)').matches ?? false) ||
		(env.matchMedia?.('(display-mode: fullscreen)').matches ?? false);
	return isStandalone ? 'standalone' : 'browser';
}
