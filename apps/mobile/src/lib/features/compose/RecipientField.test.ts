import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import RecipientField from './RecipientField.svelte';

const ADA = {
	id: 'c1',
	email: 'ada@example.com',
	name: 'Ada Lovelace',
	lastContactedAt: null,
	frequency: 3
};

function setup(search = vi.fn().mockResolvedValue([ADA])) {
	render(RecipientField, { label: 'To', search });
	return { input: screen.getByRole('combobox', { name: 'To' }), search };
}

async function type(input: HTMLElement, value: string, key: string) {
	await fireEvent.input(input, { target: { value } });
	await fireEvent.keyDown(input, { key });
}

describe('RecipientField', () => {
	it('turns typed addresses into chips on Enter and flags invalid ones', async () => {
		const { input } = setup(vi.fn().mockResolvedValue([]));
		await type(input, 'grace@example.com', 'Enter');
		await type(input, 'nope', ',');
		expect(screen.getByText('grace@example.com')).toBeInTheDocument();
		expect(screen.getByText('Not a valid email address', { selector: 'p' })).toBeInTheDocument();
		expect(input).toHaveAttribute('aria-invalid', 'true');

		await fireEvent.click(screen.getByRole('button', { name: 'Remove nope' }));
		expect(input).not.toHaveAttribute('aria-invalid');
	});

	it('suggests contacts and picks one with the keyboard', async () => {
		const { input, search } = setup();
		await fireEvent.input(input, { target: { value: 'ada' } });
		const option = await screen.findByRole('option', { name: /Ada Lovelace/ });
		expect(option).toHaveAttribute('aria-selected', 'true');
		expect(search).toHaveBeenLastCalledWith('ada');

		await fireEvent.keyDown(input, { key: 'Enter' });
		expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
		expect(screen.queryByRole('option')).not.toBeInTheDocument();
		expect(input).toHaveValue('');
	});

	it('splits a pasted list and removes the last chip with Backspace', async () => {
		const { input } = setup(vi.fn().mockResolvedValue([]));
		await fireEvent.paste(input, {
			clipboardData: { getData: () => 'a@x.com; b@x.com, a@x.com' }
		});
		expect(screen.getAllByRole('button', { name: /^Remove/ })).toHaveLength(2);

		await fireEvent.keyDown(input, { key: 'Backspace' });
		expect(screen.queryByText('b@x.com')).not.toBeInTheDocument();
		expect(screen.getByText('a@x.com')).toBeInTheDocument();
	});
});
