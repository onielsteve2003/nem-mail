import { expect, test } from '@playwright/test';

test('Ionic components register, render and take the theme color', async ({ page }) => {
	await page.goto('/onboarding');

	await expect(page.locator('ion-app')).toHaveClass(/hydrated/);

	// No screen uses ion-button, so add one to prove Ionic picks up our tokens.
	await page.evaluate(() => {
		const probe = document.createElement('ion-button');
		probe.textContent = 'Probe';
		document.querySelector('ion-app')?.append(probe);
	});
	const button = page.locator('ion-button');
	await expect(button).toHaveClass(/hydrated/);

	// The button paints with our accent token (--nm-color-accent), not Ionic's default blue.
	const background = await button.evaluate((el) => {
		const native = el.shadowRoot?.querySelector('.button-native');
		return native ? getComputedStyle(native).backgroundColor : null;
	});
	expect(background).toBe('rgb(112, 80, 245)');
});
