import { expect, test, type Page } from '@playwright/test';

/** Signs in to the demo account and waits for the first Inbox rows. */
async function openInbox(page: Page): Promise<void> {
	await page.goto('/');
	// First launch seeds IndexedDB behind the splash; Playwright's WebKit on Windows takes ~9 s.
	await page.getByRole('button', { name: 'Try the demo' }).click({ timeout: 20_000 });
	await expect(page).toHaveURL(/\/mail\/inbox$/);
	await expect(page.locator('.row').first()).toBeVisible({ timeout: 10_000 });
}

test('F6 search: type a query, see highlighted results, narrow with a chip, find it in recent', async ({
	page
}) => {
	await openInbox(page);
	// A word from the first Inbox subject, so the demo data always has a match.
	const subject = (await page.locator('.row__subject').first().textContent()) ?? '';
	const word = subject.match(/[A-Za-z]{4,}/)?.[0]?.toLowerCase() ?? '';
	expect(word).not.toBe('');

	await page.locator('a.field').click();
	await expect(page).toHaveURL(/\/search$/);
	const field = page.getByRole('searchbox', { name: 'Search in mail' });
	await expect(field).toBeFocused();

	await field.fill(word);
	await expect(page.getByRole('button', { name: `Search for "${word}"` })).toBeVisible();
	await field.press('Enter');
	await expect(page).toHaveURL(new RegExp(`\\?q=${word}$`));

	const results = page.locator('.results .row');
	await expect(results.first()).toBeVisible({ timeout: 10_000 });
	await expect(page.locator('.results mark').first()).toHaveText(new RegExp(word, 'i'));

	// The Unread chip writes is:unread and only unread threads stay (or none match).
	const filters = page.getByRole('group', { name: 'Filters' });
	await filters.getByRole('button', { name: 'Unread' }).click();
	await expect(page).toHaveURL(new RegExp(`\\?q=${word}(\\+|%20)is%3Aunread$`));
	await expect(filters.getByRole('button', { name: 'Unread' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await expect(page.locator('section.results')).toHaveAttribute('aria-busy', 'false');
	await expect(page.locator('.results .row:not(.row--unread)')).toHaveCount(0);

	// The Date chip opens its option sheet and writes before:.
	await filters.getByRole('button', { name: 'Date' }).click();
	await page.getByRole('button', { name: 'Older than a year' }).click();
	await expect(page).toHaveURL(/before%3A\d{4}-\d{2}-\d{2}/);

	// Clearing the field shows the submitted searches under Recent.
	await field.fill('');
	await expect(page.getByRole('heading', { name: 'Recent searches' })).toBeVisible();
	await expect(page.getByRole('button', { name: word, exact: true })).toBeVisible();
});

test('F6 search: Semantic asks for the model before it ranks by meaning', async ({ page }) => {
	await openInbox(page);
	await page.goto('/search?q=the');
	await expect(page.locator('.results .row').first()).toBeVisible({ timeout: 10_000 });

	const semantic = page.getByRole('button', { name: 'Semantic' });
	await semantic.click();
	await expect(semantic).toHaveAttribute('aria-pressed', 'true');
	// No model on a fresh device: the toggle explains and offers the download, keyword results stay.
	await expect(page.getByRole('button', { name: 'Download model' })).toBeVisible();
	await expect(page.locator('.results .row').first()).toBeVisible();
});
