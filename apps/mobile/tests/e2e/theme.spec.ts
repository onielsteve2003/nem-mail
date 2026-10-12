import { expect, test } from '@playwright/test';

const DARK_BG = 'rgb(11, 11, 20)';
const LIGHT_BG = 'rgb(250, 247, 242)';

const backgroundOf = (page: import('@playwright/test').Page) =>
	page.locator('body').evaluate((el) => getComputedStyle(el).backgroundColor);

test('follows the system light setting', async ({ page }) => {
	await page.emulateMedia({ colorScheme: 'light' });
	await page.goto('/');

	await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
	expect(await backgroundOf(page)).toBe(LIGHT_BG);
	await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#faf7f2');
});

test('follows the system dark setting and switches live', async ({ page }) => {
	await page.emulateMedia({ colorScheme: 'dark' });
	await page.goto('/');
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
	expect(await backgroundOf(page)).toBe(DARK_BG);

	await page.emulateMedia({ colorScheme: 'light' });
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('a saved choice wins over the system and is painted before the app boots', async ({
	page
}) => {
	await page.emulateMedia({ colorScheme: 'dark' });
	await page.addInitScript(() => localStorage.setItem('nm-theme', 'light'));
	// Record the theme at DOMContentLoaded, before the Svelte app has mounted.
	await page.addInitScript(() =>
		document.addEventListener('DOMContentLoaded', () => {
			(window as unknown as { earlyTheme?: string }).earlyTheme =
				document.documentElement.dataset.theme;
		})
	);
	await page.goto('/');

	expect(await page.evaluate(() => (window as unknown as { earlyTheme?: string }).earlyTheme)).toBe(
		'light'
	);
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});
