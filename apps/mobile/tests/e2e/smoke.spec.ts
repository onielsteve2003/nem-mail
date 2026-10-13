import { expect, test } from '@playwright/test';

test('F1 first launch: onboarding has three slides and the demo opens Primary', async ({
	page
}) => {
	await page.goto('/');

	// First launch seeds IndexedDB behind the splash; Playwright's WebKit on Windows takes ~9 s.
	await expect(page).toHaveURL(/\/onboarding$/, { timeout: 20_000 });
	const slides = page.getByRole('button', { name: /^Slide \d: / });
	await expect(slides).toHaveCount(3);
	await expect(slides.first()).toHaveAttribute('aria-current', 'step');
	await page.getByRole('button', { name: 'Next', exact: true }).click();
	await expect(slides.nth(1)).toHaveAttribute('aria-current', 'step');

	await page.getByRole('button', { name: 'Try the demo' }).click();
	await expect(page).toHaveURL(/\/mail\/inbox$/);
	const tabs = page.getByRole('tablist', { name: 'Inbox categories' });
	await expect(tabs.getByRole('tab', { selected: true })).toHaveText(/Primary/);

	// The session survives a reload, so onboarding is skipped.
	await page.goto('/onboarding');
	await expect(page).toHaveURL(/\/mail\/inbox$/);
});
