import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import SelectionBar from './SelectionBar.svelte';

describe('SelectionBar', () => {
	it('announces the count and toggles select all', async () => {
		const onselectall = vi.fn();
		const { rerender } = render(SelectionBar, {
			count: 2,
			isAllSelected: false,
			onselectall,
			onexit: vi.fn()
		});
		expect(screen.getByText('2 selected')).toHaveAttribute('aria-live', 'polite');
		await fireEvent.click(screen.getByRole('button', { name: 'Select all' }));
		expect(onselectall).toHaveBeenCalledOnce();
		await rerender({ count: 5, isAllSelected: true });
		expect(screen.getByText('5 selected')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Deselect all' })).toBeInTheDocument();
	});

	it('exits with the X button and with Escape', async () => {
		const onexit = vi.fn();
		render(SelectionBar, { count: 1, isAllSelected: false, onselectall: vi.fn(), onexit });
		await fireEvent.click(screen.getByRole('button', { name: 'Exit selection' }));
		await fireEvent.keyDown(window, { key: 'Escape' });
		expect(onexit).toHaveBeenCalledTimes(2);
	});
});
