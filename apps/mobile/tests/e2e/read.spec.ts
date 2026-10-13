import { expect, test } from '@playwright/test';
import { openInbox } from './helpers.js';

test('F4 read: open an unread thread, it is marked read, j moves to the next thread', async ({
	page
}) => {
	await openInbox(page);
	const unread = page.locator('.row--unread').first();
	const link = unread.locator('.row__link');
	const href = (await link.getAttribute('href')) ?? '';
	const subject = (await unread.locator('.row__subject').textContent())?.trim() ?? '';
	// The thread after it in the list, which j opens.
	const rows = page.locator('.row__link');
	const hrefs = await rows.evaluateAll((links) => links.map((a) => a.getAttribute('href')));
	const nextHref = hrefs[hrefs.indexOf(href) + 1];

	await link.click();
	await expect(page).toHaveURL(new RegExp(`${href}$`));
	await expect(page.getByRole('heading', { level: 1 })).toHaveText(subject);
	// The latest message starts open with its body rendered.
	await expect(page.locator('.thread .html, .thread .text').last()).toBeVisible();

	if (nextHref) {
		await page.keyboard.press('j');
		await expect(page).toHaveURL(new RegExp(`${nextHref}$`));
	}

	await page.getByRole('button', { name: 'Back', exact: true }).click();
	await expect(page).toHaveURL(/\/mail\/inbox$/);
	await expect(page.locator(`.row:has(.row__link[href$="${href}"])`)).not.toHaveClass(
		/row--unread/
	);
});
