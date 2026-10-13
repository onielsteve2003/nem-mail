import { expect, test } from '@playwright/test';
import { openInbox } from './helpers.js';

test('F7 navigate: the drawer opens mailboxes and labels and the list follows', async ({
	page
}) => {
	await openInbox(page);
	const heading = page.getByRole('heading', { level: 1 });
	const nav = page.getByRole('navigation', { name: 'Mailboxes' });

	await page.getByRole('button', { name: 'Open menu' }).click();
	await expect(nav).toBeVisible();
	await nav.getByRole('link', { name: /^Sent/ }).click();
	await expect(page).toHaveURL(/\/mail\/sent$/);
	await expect(nav).toBeHidden();
	await expect(heading).toHaveText('Sent');
	await expect(page.locator('.row').first()).toBeVisible({ timeout: 10_000 });

	await page.getByRole('button', { name: 'Open menu' }).click();
	await nav.getByRole('link', { name: /^Starred/ }).click();
	await expect(page).toHaveURL(/\/mail\/starred$/);
	await expect(heading).toHaveText('Starred');

	// The first custom label under Labels.
	await page.getByRole('button', { name: 'Open menu' }).click();
	const label = nav.locator('a[href*="/mail/label/"]').first();
	const name = ((await label.locator('.list-item__title').textContent()) ?? '').trim();
	await label.click();
	await expect(page).toHaveURL(/\/mail\/label\/[^/]+$/);
	await expect(heading).toHaveText(name);
});
