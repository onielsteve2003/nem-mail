import { Capacitor } from '@capacitor/core';
import type { Theme } from './theme.js';

/**
 * Matches the native status bar to the theme: light icons on the dark theme, dark icons
 * on the light one. The web needs nothing here: ThemeStore.apply() sets the theme-color
 * meta, which browsers and the installed PWA use for their bars.
 */
export async function syncStatusBar(theme: Theme): Promise<void> {
	if (!Capacitor.isNativePlatform()) return;
	const { StatusBar, Style } = await import('@capacitor/status-bar');
	// Style.Dark means "for dark backgrounds", i.e. light icons.
	await StatusBar.setStyle({ style: theme === 'dark' ? Style.Dark : Style.Light });
}
