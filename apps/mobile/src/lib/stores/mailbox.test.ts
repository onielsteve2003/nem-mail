import 'fake-indexeddb/auto';
import { AppError } from '@nem/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Repositories } from '#lib/data/repositories.js';
import { DEMO_EMAIL, createTestRepositories } from '#lib/data/testing.js';
import { MailboxStore } from './mailbox.svelte.js';
import { ThreadStore } from './thread.svelte.js';
import { ToastStore } from './toast.svelte.js';

const NOW = Date.parse('2026-10-11T09:00:00.000Z');
const INBOX = { mailbox: 'inbox' } as const;
const ARCHIVE = { mailbox: 'all' } as const;
let repos: Repositories;
let close: () => void;
let toasts: ToastStore;
let threads: ThreadStore;
let mailbox: MailboxStore;

beforeEach(async () => {
	const created = await createTestRepositories(NOW);
	repos = created.repos;
	close = () => created.db.close();
	await repos.auth.signIn({ email: DEMO_EMAIL, password: 'anything-goes' });
	toasts = new ToastStore();
	threads = new ThreadStore(repos.mail);
	mailbox = new MailboxStore({ mail: repos.mail, threads, toasts, now: () => NOW });
	await mailbox.load(INBOX);
});

afterEach(() => {
	toasts.clear();
	close();
});

function inboxIds(): string[] {
	return mailbox.list(INBOX)?.items.map((t) => t.id) ?? [];
}

describe('MailboxStore optimistic updates', () => {
	it('removes archived rows at once, before the server answers', async () => {
		const [first, second] = inboxIds();
		const saving = mailbox.apply([first ?? '', second ?? ''], { op: 'archive' });
		expect(inboxIds()).not.toContain(first);
		expect(inboxIds()).not.toContain(second);
		expect(await saving).toBe(true);
		expect(toasts.current).toMatchObject({
			message: 'Archived: 2 conversations',
			action: { label: 'Undo' }
		});
		expect(mailbox.list(INBOX)?.isStale).toBe(true);

		// The server agrees once the list is fetched again.
		await mailbox.load(INBOX);
		expect(inboxIds()).not.toContain(first);
	});

	it('rolls lists and open threads back when the server refuses', async () => {
		const [id = ''] = inboxIds();
		await threads.load(id);
		const before = JSON.stringify(mailbox.lists);
		vi.spyOn(repos.mail, 'apply').mockRejectedValueOnce(new AppError('NETWORK', 'down'));

		const saving = mailbox.apply([id], { op: 'trash' });
		expect(inboxIds()).not.toContain(id);
		expect(threads.get(id)?.thread?.mailboxes).toContain('trash');
		expect(await saving).toBe(false);

		expect(JSON.stringify(mailbox.lists)).toBe(before);
		expect(threads.get(id)?.thread?.mailboxes).toContain('inbox');
		expect(toasts.current).toMatchObject({ tone: 'error', action: { label: 'Retry' } });

		// Retry sends the same op again.
		toasts.runAction(toasts.current?.id ?? 0);
		await vi.waitFor(() => expect(inboxIds()).not.toContain(id));
		await vi.waitFor(() => expect(toasts.current?.message).toBe('Moved to Trash'));
	});

	it('offers no Retry for an error that will not go away', async () => {
		const [id = ''] = inboxIds();
		vi.spyOn(repos.mail, 'apply').mockRejectedValueOnce(new AppError('FORBIDDEN', 'no'));
		await mailbox.apply([id], { op: 'star' });
		expect(toasts.current).toMatchObject({ tone: 'error', action: undefined });
	});

	it('undoes an archive back into the inbox, saved on the server', async () => {
		const [id = ''] = inboxIds();
		await mailbox.apply([id], { op: 'archive' });
		toasts.runAction(toasts.current?.id ?? 0);
		await vi.waitFor(async () => expect((await repos.mail.get(id)).mailboxes).toContain('inbox'));
	});

	it('undoes a trash from the archive back to the archive, not the inbox', async () => {
		await repos.mail.apply([inboxIds()[0] ?? ''], { op: 'archive' });
		await mailbox.load(ARCHIVE);
		const archived = mailbox
			.list(ARCHIVE)
			?.items.find((t) => !t.mailboxes.some((m) => ['inbox', 'spam', 'trash'].includes(m)));
		const id = archived?.id ?? '';
		const original = [...(archived?.mailboxes ?? [])];
		expect(id).not.toBe('');

		await mailbox.apply([id], { op: 'trash' });
		expect((await repos.mail.get(id)).mailboxes).toContain('trash');
		toasts.runAction(toasts.current?.id ?? 0);
		await vi.waitFor(async () => {
			expect((await repos.mail.get(id)).mailboxes).toEqual(original);
		});
	});

	it('shows no toast for quiet ops and ignores an empty selection', async () => {
		const apply = vi.spyOn(repos.mail, 'apply');
		expect(await mailbox.apply([], { op: 'archive' })).toBe(true);
		expect(apply).not.toHaveBeenCalled();
		const [id = ''] = inboxIds();
		await mailbox.apply([id, id], { op: 'star' });
		expect(apply).toHaveBeenCalledWith([id], { op: 'star' });
		expect(toasts.current).toBeUndefined();
		expect(mailbox.list(INBOX)?.items[0]?.isStarred).toBe(true);
	});
});

describe('MailboxStore.refresh', () => {
	it('checks for new mail, then reloads the first page', async () => {
		const sync = vi.fn(async () => {});
		const store = new MailboxStore({ mail: repos.mail, toasts, sync, now: () => NOW });
		await store.load(INBOX);
		const list = vi.spyOn(repos.mail, 'list');
		await store.refresh(INBOX);
		expect(sync).toHaveBeenCalledOnce();
		expect(list).toHaveBeenCalledOnce();
		expect(store.list(INBOX)?.status).toBe('ready');
	});

	it('still reloads when the check fails', async () => {
		const error = vi.spyOn(console, 'error').mockImplementation(() => {});
		const sync = vi.fn(async () => {
			throw new Error('offline');
		});
		const store = new MailboxStore({ mail: repos.mail, toasts, sync, now: () => NOW });
		await store.load(INBOX);
		const list = vi.spyOn(repos.mail, 'list');
		await store.refresh(INBOX);
		expect(list).toHaveBeenCalledOnce();
		expect(error).toHaveBeenCalled();
	});
});
