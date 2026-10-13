import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/** WCAG 2.2 AA (PRD §Non-functional), which includes 4.5:1 text contrast. */
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/** Runs axe on the page as it is now and fails with a readable list of what broke. */
async function expectNoViolations(page: Page, screen: string, within?: string): Promise<void> {
	// WebKit reads text as hidden while it is still animating in (rows, tabs, page enter).
	// Infinite ones (the aurora backdrop) never end, so only finite ones are awaited.
	await page.waitForFunction(() =>
		document
			.getAnimations()
			.every((a) => a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity)
	);
	const axe = new AxeBuilder({ page }).withTags(TAGS);
	if (within) axe.include(within);
	const { violations } = await axe.analyze();
	const found = violations.map(
		(v) =>
			`${screen}: ${v.id} (${v.impact}) ${v.help}\n` +
			v.nodes
				.slice(0, 5)
				.map((n) => `    ${n.target.join(' ')}:${n.failureSummary?.split('\n')[1]?.trim()}`)
				.join('\n')
	);
	expect.soft(found, found.join('\n')).toEqual([]);
}

for (const scheme of ['dark', 'light'] as const) {
	test(`no axe violations on the main screens (${scheme})`, async ({ page }) => {
		test.setTimeout(90_000);
		await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });

		await page.goto('/');
		const demo = page.getByRole('button', { name: 'Try the demo' });
		await expect(demo).toBeVisible({ timeout: 20_000 });
		await expectNoViolations(page, 'welcome');

		await demo.click();
		await expect(page).toHaveURL(/\/mail\/inbox$/);
		await expect(page.locator('.row').first()).toBeVisible({ timeout: 10_000 });
		await expectNoViolations(page, 'inbox');

		await page.locator('.row__link').first().click();
		await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
		await expect(page.locator('.thread .html, .thread .text').last()).toBeVisible();
		await expectNoViolations(page, 'thread');

		await page.getByRole('button', { name: 'Back', exact: true }).click();
		await page.getByRole('button', { name: 'Compose' }).click();
		await expect(page.getByRole('dialog')).toBeVisible();
		// Compose is aria-modal with a focus trap, so the list behind it is out of reach.
		await expectNoViolations(page, 'compose', '[role="dialog"]');
		await page.keyboard.press('Escape');

		await page.goto('/search?q=the');
		await expect(page.locator('.row').first()).toBeVisible({ timeout: 10_000 });
		await expectNoViolations(page, 'search');

		for (const path of ['/settings', '/settings/general', '/settings/ai', '/settings/account']) {
			await page.goto(path);
			await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
			await expectNoViolations(page, path);
		}
	});
}
