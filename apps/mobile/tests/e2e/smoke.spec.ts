import { APP_NAME } from '@nem/shared';
import { expect, test } from '@playwright/test';

test('home page loads', async ({ page }) => {
	await page.goto('/');

	await expect(page).toHaveTitle(APP_NAME);
	await expect(page.getByRole('heading', { level: 1, name: APP_NAME })).toBeVisible();
});
