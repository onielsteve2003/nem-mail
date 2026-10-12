import type { ThreadSummary } from '@nem/shared';
import { fireEvent, render, screen, within } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import ThreadActions from './ThreadActions.svelte';

const thread = {
	isUnread: true,
	isStarred: false,
	isImportant: false,
	isMuted: false,
	mailboxes: ['inbox'],
	labelIds: [] as string[]
} as ThreadSummary;
const labels = [{ id: 'l1', name: 'Work', color: 'violet' as const, parentId: null }];

describe('ThreadActions', () => {
	it('archives and deletes from the bar', async () => {
		const onapply = vi.fn();
		render(ThreadActions, { threads: [thread], labels, onapply });
		await fireEvent.click(screen.getByRole('button', { name: 'Archive' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
		expect(onapply.mock.calls).toEqual([[{ op: 'archive' }], [{ op: 'trash' }]]);
	});

	it('offers the rest in the overflow sheet, with a label picker', async () => {
		const onapply = vi.fn();
		render(ThreadActions, { threads: [thread], labels, onapply });
		await fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
		await fireEvent.click(await screen.findByRole('button', { name: 'Mark read' }));
		expect(onapply).toHaveBeenLastCalledWith({ op: 'markRead' });

		await fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
		await fireEvent.click(await screen.findByRole('button', { name: 'Labels…' }));
		const picker = await screen.findByRole('dialog', { name: 'Labels' });
		await fireEvent.click(within(picker).getByRole('checkbox', { name: 'Work' }));
		await fireEvent.click(within(picker).getByRole('button', { name: 'Apply' }));
		expect(onapply).toHaveBeenLastCalledWith([{ op: 'addLabels', labelIds: ['l1'] }]);
	});

	it('puts read state in the bar for the thread view', async () => {
		const onapply = vi.fn();
		render(ThreadActions, {
			threads: [{ ...thread, isUnread: false }],
			labels,
			onapply,
			readInBar: true
		});
		await fireEvent.click(screen.getByRole('button', { name: 'Mark unread' }));
		expect(onapply).toHaveBeenLastCalledWith({ op: 'markUnread' });

		await fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
		const sheet = await screen.findByRole('dialog', { name: 'More actions' });
		expect(within(sheet).getByRole('button', { name: 'Star' })).toBeInTheDocument();
		expect(within(sheet).queryByRole('button', { name: /Mark (un)?read/ })).toBeNull();
	});

	it('deletes forever after a confirmation and offers Not spam in Spam', async () => {
		const onapply = vi.fn();
		const ondeleteforever = vi.fn();
		const spam = { ...thread, mailboxes: ['spam'] } as ThreadSummary;
		render(ThreadActions, { threads: [spam], labels, onapply, ondeleteforever });
		expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
		await fireEvent.click(screen.getByRole('button', { name: 'Delete forever' }));
		const dialog = await screen.findByRole('alertdialog', { name: 'Delete forever?' });
		expect(ondeleteforever).not.toHaveBeenCalled();
		await fireEvent.click(within(dialog).getByRole('button', { name: 'Delete forever' }));
		expect(ondeleteforever).toHaveBeenCalledOnce();

		await fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
		const sheet = await screen.findByRole('dialog', { name: 'More actions' });
		expect(within(sheet).queryByRole('button', { name: 'Report spam' })).toBeNull();
		await fireEvent.click(within(sheet).getByRole('button', { name: 'Not spam' }));
		expect(onapply).toHaveBeenLastCalledWith({ op: 'notSpam' });
	});
});
