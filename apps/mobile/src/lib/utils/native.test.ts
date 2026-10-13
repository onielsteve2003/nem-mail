import { afterEach, describe, expect, it, vi } from 'vitest';

// The native paths: Capacitor reports a native platform and each plugin is a fake.
const plugins = vi.hoisted(() => ({
	setStyle: vi.fn(async () => {}),
	hide: vi.fn(async () => {}),
	impact: vi.fn(async () => {})
}));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => true } }));
vi.mock('@capacitor/status-bar', () => ({
	StatusBar: { setStyle: plugins.setStyle },
	Style: { Dark: 'DARK', Light: 'LIGHT' }
}));
vi.mock('@capacitor/splash-screen', () => ({ SplashScreen: { hide: plugins.hide } }));
vi.mock('@capacitor/haptics', () => ({
	Haptics: { impact: plugins.impact },
	ImpactStyle: { Light: 'LIGHT' }
}));

const { syncStatusBar } = await import('./status-bar.js');
const { hideSplashScreen } = await import('./splash-screen.js');
const { hapticTick } = await import('./haptics.js');

afterEach(() => vi.clearAllMocks());

describe('native plugins', () => {
	it('gives the dark theme light status bar icons and the light theme dark ones', async () => {
		await syncStatusBar('dark');
		await syncStatusBar('light');
		expect(plugins.setStyle.mock.calls).toEqual([[{ style: 'DARK' }], [{ style: 'LIGHT' }]]);
	});

	it('hides the launch screen with a fade', async () => {
		await hideSplashScreen();
		expect(plugins.hide).toHaveBeenCalledWith({ fadeOutDuration: 200 });
	});

	it('ticks through the Haptics plugin', async () => {
		hapticTick();
		await vi.waitFor(() => expect(plugins.impact).toHaveBeenCalledWith({ style: 'LIGHT' }));
	});
});
