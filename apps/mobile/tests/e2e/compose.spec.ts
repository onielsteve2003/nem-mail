import { expect, test, type Page } from '@playwright/test';

/** Signs in to the demo account and waits for the first Inbox rows. */
async function openInbox(page: Page): Promise<void> {
	await page.goto('/');
	// First launch seeds IndexedDB behind the splash; Playwright's WebKit on Windows takes ~9 s.
	await page.getByRole('button', { name: 'Try the demo' }).click({ timeout: 20_000 });
	await expect(page).toHaveURL(/\/mail\/inbox$/);
	await expect(page.locator('.row').first()).toBeVisible({ timeout: 10_000 });
}

/** Opens compose from the floating button and fills To and Subject. */
async function startMessage(page: Page, subject: string) {
	await page.getByRole('button', { name: 'Compose' }).click();
	const compose = page.getByRole('dialog', { name: 'New message' });
	await expect(compose).toBeVisible();
	const to = compose.getByLabel('To', { exact: true });
	await to.fill('ada@example.com');
	await to.press('Enter');
	await expect(compose.getByText('ada@example.com')).toBeVisible();
	await compose.getByLabel('Subject').fill(subject);
	return compose;
}

const toast = (page: Page, text: string | RegExp) =>
	page.getByRole('status').filter({ hasText: text });

test('F5 compose: write with an attachment and send', async ({ page }) => {
	await openInbox(page);
	const compose = await startMessage(page, 'E2E sent message');
	await compose.getByRole('textbox', { name: 'Message body' }).click();
	await page.keyboard.type('Hello from the compose test.');
	await compose.locator('input[type=file]').setInputFiles({
		name: 'notes.txt',
		mimeType: 'text/plain',
		buffer: Buffer.from('notes')
	});
	await expect(compose.getByText('notes.txt')).toBeVisible();
	// The mock upload fills its bar before the chip is ready to send.
	await expect(compose.getByRole('progressbar')).toHaveCount(0, { timeout: 5_000 });

	await compose.getByRole('button', { name: 'Send', exact: true }).click();
	await expect(compose).toBeHidden();
	await expect(toast(page, /^Sent/)).toBeVisible();
});

test('F5 compose: closing saves a draft, and a message can be scheduled', async ({ page }) => {
	await openInbox(page);
	let compose = await startMessage(page, 'E2E saved draft');
	await compose.getByRole('button', { name: 'Close compose' }).click();
	await expect(toast(page, 'Draft saved')).toBeVisible();

	compose = await startMessage(page, 'E2E scheduled message');
	await compose.getByRole('button', { name: 'Schedule send' }).click();
	await page.getByRole('button', { name: /Tomorrow morning/ }).click();
	await expect(compose).toBeHidden();
	await expect(toast(page, /Scheduled for/)).toBeVisible();

	await page.goto('/mail/drafts');
	await expect(page.getByText('E2E saved draft')).toBeVisible({ timeout: 10_000 });
	await page.goto('/mail/scheduled');
	await expect(page.getByText('E2E scheduled message')).toBeVisible({ timeout: 10_000 });
});
