import type { CapacitorConfig } from '@capacitor/cli';

// --nm-color-bg of the dark theme, so the launch screen matches the in-app splash.
const LAUNCH_BACKGROUND = '#0b0b14';

const config: CapacitorConfig = {
	appId: 'com.onahstephen.nemmail',
	appName: 'Nem Mail',
	// The adapter-static SPA output; run `npm run build` before `npx cap sync`.
	webDir: 'build',
	backgroundColor: LAUNCH_BACKGROUND,
	plugins: {
		// The layout hides it once the session is restored (lib/utils/splash-screen.ts).
		SplashScreen: {
			launchAutoHide: false,
			backgroundColor: LAUNCH_BACKGROUND,
			showSpinner: false
		},
		// The app draws under the status bar and pads with the safe-area insets;
		// lib/utils/status-bar.ts flips the icon color with the theme.
		StatusBar: { overlaysWebView: true, style: 'DARK' },
		// The web view shrinks above the keyboard (the default "native" resize), even in
		// full screen, so inputs stay in view.
		Keyboard: { resizeOnFullScreen: true }
	}
};

export default config;
