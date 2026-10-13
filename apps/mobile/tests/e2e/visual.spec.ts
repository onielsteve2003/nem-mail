import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

// A fixed clock seeds the same demo mailbox every run (and stops simulated arrivals,
// which wait for time to pass), so relative dates and rows match the baselines.
const NOW = new Date('2026-06-01T09:00:00Z');

test.use({ timezoneId: 'UTC', locale: 'en-US' });

const shot = { stylePath: join(import.meta.dirname, 'visual.css') };

/** Parks the pointer and waits for finite animations (page enter, rows) to settle. */
async function settle(page: Page): Promise<void> {
	// A pointer left over a button from the last click would snapshot its hover state.
	await page.mouse.move(0, 0);
	// A reload shows the splash again; its exit runs as the screen appears.
	await expect(page.locator('.splash')).toHaveCount(0);
	await page.waitForFunction(() =>
		document
			.getAnimations()
			.every((a) => a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity)
	);
}

for (const scheme of ['dark', 'light'] as const) {
	test(`key screens match their snapshots (${scheme})`, async ({ page }) => {
		test.setTimeout(90_000);
		await page.clock.setFixedTime(NOW);
		await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });

		await page.goto('/');
		const demo = page.getByRole('button', { name: 'Try the demo' });
		await expect(demo).toBeVisible({ timeout: 20_000 });
		await settle(page);
		await expect(page).toHaveScreenshot(`welcome-${scheme}.png`, shot);

		await demo.click();
		await expect(page.locator('.row').first()).toBeVisible({ timeout: 10_000 });
		// The bundles and their senders load after the rows; wait until every bundle shows them.
		await expect(page.locator('.bundle').first()).toBeVisible();
		await expect(page.locator('.bundle__senders').filter({ hasText: /\w/ })).toHaveCount(
			await page.locator('.bundle').count()
		);
		await settle(page);
		await expect(page).toHaveScreenshot(`inbox-${scheme}.png`, shot);

		await page.locator('.row__link').first().click();
		await expect(page.locator('.thread .html, .thread .text').last()).toBeVisible();
		await settle(page);
		await expect(page).toHaveScreenshot(`thread-${scheme}.png`, shot);

		await page.goto('/search?q=the');
		await expect(page.locator('.results .row').first()).toBeVisible({ timeout: 10_000 });
		await settle(page);
		await expect(page).toHaveScreenshot(`search-${scheme}.png`, shot);

		await page.goto('/settings');
		// By name: the reload's splash has its own h1.
		await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
		await settle(page);
		await expect(page).toHaveScreenshot(`settings-${scheme}.png`, shot);
	});
}
