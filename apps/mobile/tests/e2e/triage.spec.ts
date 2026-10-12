import { expect, test, type Locator, type Page } from '@playwright/test';

/** Signs in to the demo account and waits for the first Inbox rows. */
async function openInbox(page: Page): Promise<void> {
	await page.goto('/');
	// First launch seeds IndexedDB behind the splash; Playwright's WebKit on Windows takes ~9 s.
	await page.getByRole('button', { name: 'Try the demo' }).click({ timeout: 20_000 });
	await expect(page).toHaveURL(/\/mail\/inbox$/);
	await expect(page.locator('.row').first()).toBeVisible({ timeout: 10_000 });
}

/** The nth row's thread link, found by thread id so it can be followed after an action. */
async function rowLink(page: Page, index: number) {
	const href = await page.locator('.row__link').nth(index).getAttribute('href');
	const id = href?.split('/').pop() ?? '';
	return page.locator(`.row__link[href$="/${id}"]`);
}

/** The element's box once it stops moving (rows shift while the category bundles load). */
async function stableBox(locator: Locator) {
	let last = await locator.boundingBox();
	for (let tries = 0; tries < 20; tries++) {
		await locator.page().waitForTimeout(150);
		const next = await locator.boundingBox();
		if (next && last && next.y === last.y && next.width === last.width) return next;
		last = next;
	}
	throw new Error('The row never settled');
}

test('F2: swipe archives with Undo, and snoozed mail moves to Snoozed', async ({ page }) => {
	await openInbox(page);
	const box = await stableBox(page.locator('.swipe').first());
	const row = await rowLink(page, 0);

	// The default left swipe archives (Settings > swipe actions can change it).
	const y = box.y + box.height / 2;
	await page.mouse.move(box.x + box.width - 20, y);
	await page.mouse.down();
	for (let step = 1; step <= 10; step++) {
		await page.mouse.move(box.x + box.width - 20 - step * box.width * 0.07, y);
	}
	await page.mouse.up();

	const toast = page.getByRole('status').filter({ hasText: 'Archived' });
	await expect(toast).toBeVisible();
	await expect(row).toHaveCount(0);
	await toast.getByRole('button', { name: 'Undo' }).click();
	await expect(row).toBeVisible();

	// Snooze through selection (the swipe's snooze picker arrives with T8.4).
	const snoozed = await rowLink(page, 0);
	await page
		.locator('.row')
		.first()
		.getByRole('button', { name: /^Select / })
		.click();
	await page.getByRole('button', { name: 'More actions' }).click();
	await page.getByRole('button', { name: 'Snooze…' }).click();
	await page.getByRole('button', { name: 'Tomorrow' }).click();
	await expect(page.getByRole('status').filter({ hasText: 'Snoozed' })).toBeVisible();
	await expect(snoozed).toHaveCount(0);

	await page.goto('/mail/snoozed');
	await expect(snoozed).toBeVisible();
	await expect(page.locator('.row__time', { hasText: /^Until / }).first()).toBeVisible();
});

test('F3: long press selects, a bulk action runs, and Undo appears', async ({ page }) => {
	await openInbox(page);
	const first = await rowLink(page, 0);
	const second = await rowLink(page, 1);

	// A long press (the browser's context menu gesture) starts selection.
	await page.locator('.row').first().click({ button: 'right' });
	await expect(page.getByText('1 selected')).toBeVisible();
	await page
		.locator('.row')
		.nth(1)
		.getByRole('button', { name: /^Select / })
		.click();
	await expect(page.getByText('2 selected')).toBeVisible();

	await page.getByRole('button', { name: 'Archive' }).click();
	await expect(page.getByText('1 selected')).toHaveCount(0);
	const toast = page.getByRole('status').filter({ hasText: 'Archived' });
	await expect(toast).toBeVisible();
	await expect(first).toHaveCount(0);
	await expect(second).toHaveCount(0);
	await expect(toast.getByRole('button', { name: 'Undo' })).toBeVisible();
});
