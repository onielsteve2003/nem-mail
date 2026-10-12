import { expect, test } from '@playwright/test';

test('first launch shows onboarding and the demo opens the Inbox', async ({ page }) => {
	await page.goto('/');

	// First launch seeds IndexedDB behind the splash; Playwright's WebKit on Windows takes ~9 s.
	await expect(page).toHaveURL(/\/onboarding$/, { timeout: 20_000 });
	await expect(
		page.getByRole('heading', { level: 1, name: 'An inbox that keeps calm' })
	).toBeVisible();

	await page.getByRole('button', { name: 'Try the demo' }).click();
	await expect(page).toHaveURL(/\/mail\/inbox$/);

	// The session survives a reload, so onboarding is skipped.
	await page.goto('/onboarding');
	await expect(page).toHaveURL(/\/mail\/inbox$/);
});
