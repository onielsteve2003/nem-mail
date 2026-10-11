import { fireEvent, render, screen } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import Button from './Button.svelte';

const text = (value: string) => createRawSnippet(() => ({ render: () => `<span>${value}</span>` }));

describe('Button', () => {
	it('renders a primary md button of type "button"', () => {
		render(Button, { children: text('Send') });
		const button = screen.getByRole('button', { name: 'Send' });

		expect(button).toHaveAttribute('type', 'button');
		expect(button).toHaveClass('btn--primary', 'btn--md');
	});

	it('applies the variant and size', () => {
		render(Button, { variant: 'danger', size: 'lg', children: text('Delete') });

		expect(screen.getByRole('button')).toHaveClass('btn--danger', 'btn--lg');
	});

	it('calls onclick when pressed', async () => {
		const onclick = vi.fn();
		render(Button, { onclick, children: text('Send') });

		await fireEvent.click(screen.getByRole('button'));

		expect(onclick).toHaveBeenCalledOnce();
	});

	it('ignores presses while disabled', async () => {
		const onclick = vi.fn();
		render(Button, { onclick, disabled: true, children: text('Send') });

		await fireEvent.click(screen.getByRole('button'));

		expect(screen.getByRole('button')).toBeDisabled();
		expect(onclick).not.toHaveBeenCalled();
	});

	it('shows a spinner and blocks presses while loading', async () => {
		const onclick = vi.fn();
		const { container } = render(Button, { onclick, loading: true, children: text('Send') });
		const button = screen.getByRole('button', { name: 'Send' });

		await fireEvent.click(button);

		expect(button).toHaveAttribute('aria-busy', 'true');
		expect(button).toBeDisabled();
		expect(container.querySelector('.btn__spinner')).toBeInTheDocument();
		expect(onclick).not.toHaveBeenCalled();
	});

	it('renders the leading and trailing slots around the label', () => {
		render(Button, {
			leading: text('L'),
			trailing: text('T'),
			children: text('Label')
		});

		expect(screen.getByRole('button')).toHaveTextContent(/^L\s*Label\s*T$/);
	});

	it('renders a link when given an href', () => {
		render(Button, { href: '/mail/inbox', children: text('Inbox') });

		expect(screen.getByRole('link', { name: 'Inbox' })).toHaveAttribute('href', '/mail/inbox');
	});

	it('drops the href of a disabled link', () => {
		render(Button, { href: '/mail/inbox', disabled: true, children: text('Inbox') });
		const link = screen.getByRole('link', { name: 'Inbox' });

		expect(link).not.toHaveAttribute('href');
		expect(link).toHaveAttribute('aria-disabled', 'true');
	});

	it('ignores presses on a disabled link', async () => {
		const onclick = vi.fn();
		render(Button, { href: '/x', disabled: true, onclick, children: text('Go') });

		await fireEvent.click(screen.getByRole('link'));

		expect(onclick).not.toHaveBeenCalled();
	});
});
