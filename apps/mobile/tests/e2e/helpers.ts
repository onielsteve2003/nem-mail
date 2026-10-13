import { expect, type Page } from '@playwright/test';

/** Signs in to the demo account and waits for the first Inbox rows. */
export async function openInbox(page: Page): Promise<void> {
	await page.goto('/');
	// First launch seeds IndexedDB behind the splash; Playwright's WebKit on Windows takes ~9 s.
	await page.getByRole('button', { name: 'Try the demo' }).click({ timeout: 20_000 });
	await expect(page).toHaveURL(/\/mail\/inbox$/);
	await expect(page.locator('.row').first()).toBeVisible({ timeout: 10_000 });
}

/** A toast (snackbar) with the given text. */
export const toast = (page: Page, text: string | RegExp) =>
	page.getByRole('status').filter({ hasText: text });
