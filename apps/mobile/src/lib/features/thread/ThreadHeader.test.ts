import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import ThreadHeader from './ThreadHeader.svelte';

const labels = [{ id: 'l1', name: 'Work', color: 'violet' as const, parentId: null }];

describe('ThreadHeader', () => {
	it('shows the subject, important marker and labels, and closes', async () => {
		const onclose = vi.fn();
		render(ThreadHeader, { subject: 'Launch plan', labels, isImportant: true, onclose });
		expect(screen.getByRole('heading', { name: /Launch plan/ })).toBeInTheDocument();
		expect(screen.getByRole('img', { name: 'Important' })).toBeInTheDocument();
		expect(screen.getByRole('list', { name: 'Labels' })).toHaveTextContent('Work');
		await fireEvent.click(screen.getByRole('button', { name: 'Back' }));
		expect(onclose).toHaveBeenCalledOnce();
	});

	it('hides the subject while loading and names an empty one', async () => {
		const { rerender } = render(ThreadHeader, {
			subject: null,
			variant: 'close',
			onclose: vi.fn()
		});
		expect(screen.queryByRole('heading')).toBeNull();
		expect(screen.getByRole('button', { name: 'Close conversation' })).toBeInTheDocument();
		await rerender({ subject: '' });
		expect(screen.getByRole('heading')).toHaveTextContent('(no subject)');
	});
});
