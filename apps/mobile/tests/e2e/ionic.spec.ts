import { expect, test } from '@playwright/test';

test('Ionic components register, render and take the theme color', async ({ page }) => {
	await page.goto('/');

	await expect(page.locator('ion-app')).toHaveClass(/hydrated/);

	const button = page.locator('ion-button');
	await expect(button).toHaveClass(/hydrated/);
	await expect(page.getByRole('link', { name: 'View on GitHub' })).toBeVisible();

	// The button paints with our accent token (--nm-color-accent), not Ionic's default blue.
	const background = await button.evaluate((el) => {
		const native = el.shadowRoot?.querySelector('.button-native');
		return native ? getComputedStyle(native).backgroundColor : null;
	});
	expect(background).toBe('rgb(112, 80, 245)');
});
