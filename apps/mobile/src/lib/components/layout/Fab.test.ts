import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import AiOrb from './AiOrb.svelte';
import Fab from './Fab.svelte';

describe('Fab', () => {
	it('keeps its name when collapsed and calls onclick', async () => {
		const onclick = vi.fn();
		const { rerender } = render(Fab, { extended: true, onclick });
		const button = screen.getByRole('button', { name: 'Compose' });
		expect(button).not.toHaveClass('fab--collapsed');

		await rerender({ extended: false, onclick });
		expect(screen.getByRole('button', { name: 'Compose' })).toHaveClass('fab--collapsed');

		await fireEvent.click(button);
		expect(onclick).toHaveBeenCalledOnce();
	});
});

describe('AiOrb', () => {
	it('is a named button', async () => {
		const onclick = vi.fn();
		render(AiOrb, { onclick });
		await fireEvent.click(screen.getByRole('button', { name: 'AI assistant' }));
		expect(onclick).toHaveBeenCalledOnce();
	});
});
