import { fireEvent, render, screen } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import Chip from './Chip.svelte';

const text = (value: string) => createRawSnippet(() => ({ render: () => `<span>${value}</span>` }));

describe('Chip', () => {
	it('renders static text with no buttons', () => {
		render(Chip, { children: text('Has attachment') });

		expect(screen.getByText('Has attachment')).toBeInTheDocument();
		expect(screen.queryByRole('button')).toBeNull();
	});

	it('acts as a toggle that shows a check when selected', async () => {
		const onclick = vi.fn();
		const { container } = render(Chip, {
			selected: true,
			onclick,
			children: text('Unread')
		});
		const button = screen.getByRole('button', { name: 'Unread' });

		expect(button).toHaveAttribute('aria-pressed', 'true');
		expect(container.querySelector('.chip')).toHaveClass('chip--selected');
		expect(container.querySelector('svg')).toBeInTheDocument();

		await fireEvent.click(button);
		expect(onclick).toHaveBeenCalledOnce();
	});

	it('is a plain button when no selected state is given', () => {
		render(Chip, { onclick: () => {}, children: text('Thanks!') });

		expect(screen.getByRole('button', { name: 'Thanks!' })).not.toHaveAttribute('aria-pressed');
	});

	it('shows the leading slot until selected', () => {
		render(Chip, { leading: text('@'), selected: false, children: text('Ada') });

		expect(screen.getByText('@')).toBeInTheDocument();
	});

	it('has a labelled remove button', async () => {
		const onremove = vi.fn();
		render(Chip, { onremove, removeLabel: 'Remove ada@example.com', children: text('Ada') });

		await fireEvent.click(screen.getByRole('button', { name: 'Remove ada@example.com' }));

		expect(onremove).toHaveBeenCalledOnce();
	});

	it('blocks presses and removal while disabled', async () => {
		const onclick = vi.fn();
		const onremove = vi.fn();
		render(Chip, { onclick, onremove, disabled: true, children: text('Ada') });

		for (const button of screen.getAllByRole('button')) {
			expect(button).toBeDisabled();
			await fireEvent.click(button);
		}

		expect(onclick).not.toHaveBeenCalled();
		expect(onremove).not.toHaveBeenCalled();
	});
});
