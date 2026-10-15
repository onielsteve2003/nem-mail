import { expect, type Page, type Request } from '@playwright/test';

/** Signs in to the demo account and waits for the first Inbox rows. */
export async function openInbox(page: Page): Promise<void> {
	await page.goto('/');
	// First launch seeds IndexedDB behind the splash; Playwright's WebKit on Windows takes ~9 s.
	await page.getByRole('button', { name: 'Try the demo' }).click({ timeout: 20_000 });
	await expect(page).toHaveURL(/\/mail\/inbox$/);
	await expect(page.locator('.row').first()).toBeVisible({ timeout: 10_000 });
	await networkQuiet(page);
}

/**
 * Waits until no request has started or ended for `quietMs`, so late content (inbox nudges and
 * AI rows, which take several API calls on real data) has landed. The SSE stream never ends, so it
 * is ignored.
 */
export async function networkQuiet(page: Page, quietMs = 800): Promise<void> {
	let last = Date.now();
	const bump = (request: Request) => {
		if (!request.url().includes('/events/stream')) last = Date.now();
	};
	page.on('request', bump);
	page.on('requestfinished', bump);
	page.on('requestfailed', bump);
	try {
		while (Date.now() - last < quietMs) await page.waitForTimeout(100);
	} finally {
		page.off('request', bump);
		page.off('requestfinished', bump);
		page.off('requestfailed', bump);
	}
}

/** A toast (snackbar) with the given text. */
export const toast = (page: Page, text: string | RegExp) =>
	page.getByRole('status').filter({ hasText: text });
