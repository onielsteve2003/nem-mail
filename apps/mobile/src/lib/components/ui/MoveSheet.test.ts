import type { Label } from '@nem/shared';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import MoveSheet from './MoveSheet.svelte';

const labels: Label[] = [
	{ id: 'w', name: 'Work', color: 'violet', parentId: null },
	{ id: 'p', name: 'Projects', color: 'lime', parentId: 'w' }
];

describe('MoveSheet', () => {
	it('lists mailboxes, labels and inbox tabs, and sends the move ops', async () => {
		const onmove = vi.fn();
		const onclose = vi.fn();
		render(MoveSheet, { open: true, labels, onmove, onclose });
		for (const name of ['Mailboxes', 'Labels', 'Inbox tabs']) {
			expect(screen.getByRole('heading', { name })).toBeInTheDocument();
		}
		await fireEvent.click(screen.getByRole('button', { name: 'Projects' }));
		expect(onmove).toHaveBeenCalledWith([
			{ op: 'addLabels', labelIds: ['p'] },
			{ op: 'move', to: 'inbox' },
			{ op: 'archive' }
		]);
		expect(onclose).toHaveBeenCalled();
	});
});
