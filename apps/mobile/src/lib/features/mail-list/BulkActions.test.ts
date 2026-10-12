import type { ThreadSummary } from '@nem/shared';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import BulkActions from './BulkActions.svelte';

const thread = {
	isUnread: true,
	isStarred: false,
	isImportant: false,
	isMuted: false
} as ThreadSummary;
const labels = [{ id: 'l1', name: 'Work', color: 'violet' as const, parentId: null }];

describe('BulkActions', () => {
	it('archives and deletes from the bar', async () => {
		const onapply = vi.fn();
		render(BulkActions, { threads: [thread], labels, onapply });
		await fireEvent.click(screen.getByRole('button', { name: 'Archive' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
		expect(onapply.mock.calls).toEqual([[{ op: 'archive' }], [{ op: 'trash' }]]);
	});

	it('offers the rest in the overflow sheet, with a label picker', async () => {
		const onapply = vi.fn();
		render(BulkActions, { threads: [thread], labels, onapply });
		await fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
		await fireEvent.click(await screen.findByRole('button', { name: 'Mark read' }));
		expect(onapply).toHaveBeenLastCalledWith({ op: 'markRead' });

		await fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
		await fireEvent.click(await screen.findByRole('button', { name: 'Add label…' }));
		await fireEvent.click(await screen.findByRole('button', { name: 'Work' }));
		expect(onapply).toHaveBeenLastCalledWith({ op: 'addLabels', labelIds: ['l1'] });
	});
});
