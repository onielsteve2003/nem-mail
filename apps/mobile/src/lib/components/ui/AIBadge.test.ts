import { fireEvent, render, screen } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import { describe, expect, it } from 'vitest';
import AIBadge from './AIBadge.svelte';

const explanation = createRawSnippet(() => ({
	render: () => '<p>Flagged as spam: 92% confidence</p>'
}));

describe('AIBadge', () => {
	it('is a static badge without an explanation', () => {
		render(AIBadge);

		expect(screen.getByText('AI')).toBeInTheDocument();
		expect(screen.queryByRole('button')).toBeNull();
	});

	it('toggles the explanation on tap', async () => {
		render(AIBadge, { explanation });
		const button = screen.getByRole('button', { name: /AI/ });

		expect(button).toHaveAttribute('aria-expanded', 'false');
		expect(screen.queryByText(/92% confidence/)).toBeNull();

		await fireEvent.click(button);

		expect(button).toHaveAttribute('aria-expanded', 'true');
		const panel = screen.getByText(/92% confidence/).parentElement;
		expect(panel).toHaveAttribute('id', button.getAttribute('aria-controls'));
	});

	it('closes on Escape and returns focus to the badge', async () => {
		render(AIBadge, { explanation });
		const button = screen.getByRole('button', { name: /AI/ });
		await fireEvent.click(button);

		await fireEvent.keyDown(screen.getByText(/92% confidence/), { key: 'Escape' });

		expect(button).toHaveAttribute('aria-expanded', 'false');
		expect(button).toHaveFocus();
	});

	it('closes on a tap outside', async () => {
		render(AIBadge, { explanation });
		const button = screen.getByRole('button', { name: /AI/ });
		await fireEvent.click(button);

		await fireEvent.pointerDown(document.body);

		expect(button).toHaveAttribute('aria-expanded', 'false');
	});
});
