import type { Message } from '@nem/shared';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import MessageList from './MessageList.svelte';

const messages = ['a', 'b', 'c', 'd', 'e'].map(
	(id, index) =>
		({
			id,
			from: { email: `${id}@example.com`, name: `Sender ${id.toUpperCase()}` },
			to: [{ email: 'me@nem.mail' }],
			cc: [{ email: 'grace@example.com', name: 'Grace' }],
			bcc: [],
			snippet: `Snippet ${id}`,
			bodyText: `Body ${id}`,
			bodyHtml: null,
			sentAt: `2026-10-0${index + 1}T09:00:00Z`,
			isRead: true,
			attachments: []
		}) as unknown as Message
);

describe('MessageList', () => {
	it('folds earlier messages and opens only the latest', async () => {
		render(MessageList, { messages, selfEmail: 'me@nem.mail' });
		expect(screen.getByText('Body e')).toBeInTheDocument();
		expect(screen.queryByText('Body a')).toBeNull();
		expect(screen.queryByText('Sender B')).toBeNull();

		await fireEvent.click(screen.getByRole('button', { name: '2 earlier messages' }));
		expect(screen.getByText('Sender B')).toBeInTheDocument();

		await fireEvent.click(screen.getByRole('button', { name: /Sender A/ }));
		expect(screen.getByText('Body a')).toBeInTheDocument();
	});

	it('expands the recipient details', async () => {
		render(MessageList, { messages, selfEmail: 'me@nem.mail' });
		const toggle = screen.getByRole('button', { name: /to me, Grace/ });
		await fireEvent.click(toggle);
		expect(toggle).toHaveAttribute('aria-expanded', 'true');
		expect(screen.getByText('Grace <grace@example.com>')).toBeInTheDocument();
	});
});
