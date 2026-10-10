import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

export default defineConfig({
	testDir: 'tests/e2e',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	reporter: process.env.CI ? 'github' : 'list',
	use: {
		baseURL: `http://localhost:${PORT}`,
		trace: 'on-first-retry'
	},
	// The two phones we target: iPhone runs in WebKit, Pixel in Chromium.
	projects: [
		{ name: 'iphone-14', use: { ...devices['iPhone 14'] } },
		{ name: 'pixel-7', use: { ...devices['Pixel 7'] } }
	],
	// Test the production SPA build, the same output Vercel and Capacitor serve.
	webServer: {
		command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
		port: PORT,
		reuseExistingServer: !process.env.CI,
		timeout: 120_000
	}
});
