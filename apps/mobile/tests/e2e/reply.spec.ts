import { expect, test } from '@playwright/test';
import { openInbox, toast } from './helpers.js';

test('F4 reply: a smart reply chip opens a prefilled reply, Send shows Sending then Sent with Undo', async ({
	page
}) => {
	await openInbox(page);
	await page.locator('.row__link').first().click();
	await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

	// Smart replies come from the rule-based fallback until a model is downloaded.
	const replies = page.getByRole('region', { name: 'Suggested replies' });
	await expect(replies).toBeVisible({ timeout: 10_000 });
	const chip = replies.getByRole('listitem').first().getByRole('button');
	const text = ((await chip.textContent()) ?? '').trim();
	await chip.click();

	const compose = page.getByRole('dialog');
	await expect(compose).toBeVisible();
	await expect(compose.getByRole('textbox', { name: 'Message body' })).toContainText(text);
	await compose.getByRole('button', { name: 'Send', exact: true }).click();
	await expect(compose).toBeHidden();
	// "Sending…" can hand over to "Sent" mid-check, so either one counts.
	await expect(toast(page, 'Sending…').or(toast(page, /^Sent/)).first()).toBeVisible();
	await expect(toast(page, /^Sent/).getByRole('button', { name: 'Undo' })).toBeVisible();
});
