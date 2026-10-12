import 'fake-indexeddb/auto';
import { flushSync } from 'svelte';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEMO_EMAIL, DEMO_WORK_EMAIL, createTestRepositories } from '#lib/data/testing.js';
import { createAppStores, resetOnUserChange, type AppStores } from './app.svelte.js';

const NOW = Date.parse('2026-10-11T09:00:00.000Z');
const PASSWORD = 'anything-goes';
const INBOX = { mailbox: 'inbox' } as const;
let stores: AppStores;
let close: () => void;

beforeEach(async () => {
	const created = await createTestRepositories(NOW);
	stores = createAppStores(created.repos);
	close = () => created.db.close();
});

afterEach(() => close());

describe('resetOnUserChange', () => {
	it('drops lists, open threads and selection when the user changes', async () => {
		const stop = resetOnUserChange(stores);
		await stores.session.signIn({ email: DEMO_EMAIL, password: PASSWORD });
		flushSync();
		await stores.mailbox.load(INBOX);
		stores.selection.toggle('t1');
		stores.ui.openDrawer();
		flushSync();
		expect(stores.mailbox.list(INBOX)?.items.length).toBeGreaterThan(0);

		await stores.session.signIn({ email: DEMO_WORK_EMAIL, password: PASSWORD });
		flushSync();
		expect(stores.mailbox.list(INBOX)).toBeUndefined();
		expect(stores.selection.isActive).toBe(false);
		expect(stores.ui.isDrawerOpen).toBe(false);
		stop();
	});

	it('keeps state when the same user is set again', async () => {
		const stop = resetOnUserChange(stores);
		await stores.session.signIn({ email: DEMO_EMAIL, password: PASSWORD });
		flushSync();
		await stores.mailbox.load(INBOX);
		await stores.session.restore();
		flushSync();
		expect(stores.mailbox.list(INBOX)).toBeDefined();
		stop();
	});
});
