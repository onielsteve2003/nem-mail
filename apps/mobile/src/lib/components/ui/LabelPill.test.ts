import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import LabelPill from './LabelPill.svelte';

describe('LabelPill', () => {
	it('shows the name with a neutral color by default', () => {
		const { container } = render(LabelPill, { name: 'Receipts' });

		expect(screen.getByText('Receipts')).toBeInTheDocument();
		expect(container.querySelector('.pill')).toHaveClass('pill--neutral');
		expect(screen.queryByRole('button')).toBeNull();
	});

	it('applies the label color', () => {
		const { container } = render(LabelPill, { name: 'Travel', color: 'cyan' });

		expect(container.querySelector('.pill')).toHaveClass('pill--cyan');
	});

	it('has a labelled remove button', async () => {
		const onremove = vi.fn();
		render(LabelPill, { name: 'Travel', onremove });

		await fireEvent.click(screen.getByRole('button', { name: 'Remove label Travel' }));

		expect(onremove).toHaveBeenCalledOnce();
	});
});
