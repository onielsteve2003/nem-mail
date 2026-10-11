import Archive from '@lucide/svelte/icons/archive';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import IconButton from './IconButton.svelte';

describe('IconButton', () => {
	it('is named by its label and hides the icon', () => {
		const { container } = render(IconButton, { icon: Archive, label: 'Archive' });
		const button = screen.getByRole('button', { name: 'Archive' });

		expect(button).toHaveClass('btn--ghost', 'btn--icon-only');
		expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
	});

	it('forwards presses and the variant', async () => {
		const onclick = vi.fn();
		render(IconButton, { icon: Archive, label: 'Archive', variant: 'glass', onclick });

		await fireEvent.click(screen.getByRole('button', { name: 'Archive' }));

		expect(screen.getByRole('button')).toHaveClass('btn--glass');
		expect(onclick).toHaveBeenCalledOnce();
	});
});
