import 'fake-indexeddb/auto';
import { AppError, type ThreadSummary } from '@nem/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Repositories } from '#lib/data/repositories.js';
import { DEMO_EMAIL, DEMO_WORK_EMAIL, createTestRepositories } from '#lib/data/testing.js';
import { MailboxStore, listKey } from './mailbox.svelte.js';
import { SelectionStore } from './selection.svelte.js';
import { SessionStore } from './session.svelte.js';
import { ThreadStore } from './thread.svelte.js';
import { ToastStore } from './toast.svelte.js';
import { UiStore } from './ui.svelte.js';

const NOW = Date.parse('2026-10-11T09:00:00.000Z');
const PASSWORD = 'anything-goes';
const INBOX = { mailbox: 'inbox' } as const;
let repos: Repositories;
let close: () => void;

beforeEach(async () => {
	const created = await createTestRepositories(NOW);
	repos = created.repos;
	close = () => created.db.close();
});

afterEach(() => close());

async function signIn(): Promise<void> {
	await repos.auth.signIn({ email: DEMO_EMAIL, password: PASSWORD });
}

describe('SessionStore', () => {
	it('restores, signs in, switches and signs out', async () => {
		const session = new SessionStore(repos.auth);
		await session.restore();
		expect(session.status).toBe('ready');
		expect(session.isSignedIn).toBe(false);

		await session.signIn({ email: DEMO_EMAIL, password: PASSWORD });
		await session.signIn({ email: DEMO_WORK_EMAIL, password: PASSWORD });
		expect(session.user?.email).toBe(DEMO_WORK_EMAIL);
		expect(session.accounts).toHaveLength(2);

		await session.switchAccount(session.accounts[0]?.id ?? '');
		expect(session.user?.email).toBe(DEMO_EMAIL);

		await session.signOut();
		expect(session.user?.email).toBe(DEMO_WORK_EMAIL);
		expect(session.accounts).toHaveLength(1);
	});

	it('throws sign-in errors to the caller and records restore errors', async () => {
		const session = new SessionStore(repos.auth);
		await expect(
			session.signIn({ email: 'nobody@else.example', password: PASSWORD })
		).rejects.toMatchObject({ code: 'UNAUTHORIZED' });

		vi.spyOn(repos.auth, 'me').mockRejectedValueOnce(new AppError('NETWORK', 'down'));
		const failing = new SessionStore(repos.auth);
		await failing.restore();
		expect(failing.status).toBe('error');
		expect(failing.error?.code).toBe('NETWORK');
	});
});

describe('MailboxStore loading', () => {
	beforeEach(signIn);

	it('loads the first page once, then pages without duplicates', async () => {
		const list = vi.spyOn(repos.mail, 'list');
		const mailbox = new MailboxStore({ mail: repos.mail, toasts: new ToastStore() });
		const loading = mailbox.load(INBOX);
		expect(mailbox.list(INBOX)?.status).toBe('loading');
		await loading;
		await mailbox.load(INBOX);
		expect(list).toHaveBeenCalledTimes(1);

		const first = mailbox.list(INBOX);
		expect(first?.status).toBe('ready');
		expect(first?.items).toHaveLength(50);
		await mailbox.loadMore(INBOX);
		const ids = mailbox.list(INBOX)?.items.map((t) => t.id) ?? [];
		expect(ids.length).toBeGreaterThan(50);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it('shows an error state for a failed first load and a toast for a failed refresh', async () => {
		const toasts = new ToastStore();
		const mailbox = new MailboxStore({ mail: repos.mail, toasts });
		const fail = () => Promise.reject(new AppError('NETWORK', 'down'));
		const list = vi.spyOn(repos.mail, 'list').mockImplementationOnce(fail);
		await mailbox.load(INBOX);
		expect(mailbox.list(INBOX)?.status).toBe('error');
		expect(toasts.queue).toHaveLength(0);

		await mailbox.load(INBOX);
		expect(mailbox.list(INBOX)?.status).toBe('ready');
		list.mockImplementationOnce(fail);
		await mailbox.load(INBOX, { refresh: true });
		expect(mailbox.list(INBOX)?.items.length).toBe(50);
		expect(toasts.current).toMatchObject({ tone: 'error', action: { label: 'Retry' } });
		toasts.clear();
	});

	it('ingests new mail at the top of matching lists only', async () => {
		const mailbox = new MailboxStore({ mail: repos.mail, now: () => NOW });
		await mailbox.load(INBOX);
		await mailbox.load({ mailbox: 'spam' });
		const top = mailbox.list(INBOX)?.items[0] as ThreadSummary;
		const fresh: ThreadSummary = {
			...top,
			id: 'u1-new',
			lastMessageAt: new Date(NOW).toISOString()
		};
		mailbox.ingest(fresh);
		expect(mailbox.list(INBOX)?.items[0]?.id).toBe('u1-new');
		expect(mailbox.list({ mailbox: 'spam' })?.items.some((t) => t.id === 'u1-new')).toBe(false);

		// An update that no longer matches (now in spam) leaves the inbox.
		mailbox.ingest({ ...fresh, mailboxes: ['spam'] });
		expect(mailbox.list(INBOX)?.items.some((t) => t.id === 'u1-new')).toBe(false);
	});

	it('follows server events and drops responses that started before reset', async () => {
		const mailbox = new MailboxStore({ mail: repos.mail });
		const stop = mailbox.connect();
		const unread = (await repos.mail.list(INBOX)).items.find((t) => t.isUnread);
		await repos.mail.apply([unread?.id ?? ''], { op: 'markRead' });
		await vi.waitFor(() => expect(mailbox.counts).not.toBeNull());
		stop();

		const loading = mailbox.load(INBOX);
		mailbox.reset();
		await loading;
		expect(mailbox.lists).toEqual({});
		expect(mailbox.counts).toBeNull();
		await mailbox.refreshCounts();
		expect(mailbox.counts?.mailboxes.inbox).toBeGreaterThan(0);
	});

	it('keys lists by mailbox, tab or label', () => {
		expect(listKey({ mailbox: 'inbox', category: 'social' })).toBe('mailbox:inbox:social');
		expect(listKey({ labelId: 'u1-l1' })).toBe('label:u1-l1');
	});
});

describe('ThreadStore', () => {
	beforeEach(signIn);

	it('loads and caches a thread, and keeps an error for a missing one', async () => {
		const threads = new ThreadStore(repos.mail);
		const get = vi.spyOn(repos.mail, 'get');
		const [summary] = (await repos.mail.list(INBOX, { limit: 1 })).items;
		const id = summary?.id ?? '';
		await threads.load(id);
		await threads.load(id);
		expect(get).toHaveBeenCalledTimes(1);
		expect(threads.get(id)?.thread?.messages.length).toBeGreaterThan(0);

		threads.applyLocal([id], { op: 'star' });
		expect(threads.get(id)?.thread?.isStarred).toBe(true);

		await threads.load('u1-missing');
		expect(threads.get('u1-missing')).toMatchObject({ status: 'error', thread: null });
		threads.reset();
		expect(threads.get(id)).toBeUndefined();
	});
});

describe('SelectionStore', () => {
	it('toggles, selects in bulk and clears', () => {
		const selection = new SelectionStore();
		expect(selection.isActive).toBe(false);
		selection.toggle('a');
		selection.select(['b', 'c']);
		expect(selection.count).toBe(3);
		selection.toggle('a');
		selection.deselect(['b']);
		expect(selection.has('c')).toBe(true);
		expect(selection.count).toBe(1);
		selection.clear();
		expect(selection.isActive).toBe(false);
	});
});

describe('UiStore', () => {
	it('tracks the drawer and a stack of sheets', () => {
		const ui = new UiStore();
		ui.toggleDrawer();
		expect(ui.isDrawerOpen).toBe(true);
		ui.closeDrawer();
		ui.openDrawer();
		ui.openSheet('actions');
		ui.openSheet('labels');
		expect(ui.activeSheet).toBe('labels');
		ui.openSheet('actions');
		expect(ui.sheets).toEqual(['labels', 'actions']);
		ui.closeSheet();
		expect(ui.activeSheet).toBe('labels');
		ui.closeSheet('labels');
		expect(ui.activeSheet).toBeNull();
		ui.openSheet('snooze');
		expect(ui.isSheetOpen('snooze')).toBe(true);
		ui.closeAll();
		expect(ui.isDrawerOpen).toBe(false);
		expect(ui.sheets).toEqual([]);
	});

	it('opens compose with what to start from', () => {
		const ui = new UiStore();
		ui.openCompose({ mode: 'reply', threadId: 't1', messageId: 'm1' });
		expect(ui.activeSheet).toBe('compose');
		expect(ui.composeRequest).toEqual({ mode: 'reply', threadId: 't1', messageId: 'm1' });
		expect(ui.composeOrigin).toBeNull();
	});

	it('keeps the rect compose morphs from, and closes only compose', () => {
		const ui = new UiStore();
		const origin = { top: 1, right: 2, bottom: 3, left: 4, width: 5, height: 6 };
		ui.openSheet('account');
		ui.openCompose({ mode: 'new', threadId: null, messageId: null }, origin);
		expect(ui.composeOrigin).toEqual(origin);
		ui.closeCompose();
		expect(ui.activeSheet).toBe('account');
	});
});
