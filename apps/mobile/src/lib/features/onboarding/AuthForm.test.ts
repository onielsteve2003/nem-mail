import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import { AppError } from '@nem/shared';
import AuthForm from './AuthForm.svelte';

async function fill(label: string, value: string): Promise<void> {
	await fireEvent.input(screen.getByLabelText(label), { target: { value } });
}

describe('AuthForm', () => {
	it('signs up with the entered details', async () => {
		const onsubmit = vi.fn(async () => {});
		render(AuthForm, { mode: 'signUp', onsubmit });
		await fill('Name', 'Ada Lovelace');
		await fill('Email', 'ada@nemmail.example');
		await fill('Password', 'analytical');
		await fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
		expect(onsubmit).toHaveBeenCalledWith({
			name: 'Ada Lovelace',
			email: 'ada@nemmail.example',
			password: 'analytical'
		});
	});

	it('shows field errors and does not submit an invalid form', async () => {
		const onsubmit = vi.fn(async () => {});
		render(AuthForm, { mode: 'signIn', onsubmit });
		expect(screen.queryByLabelText('Name')).not.toBeInTheDocument();
		await fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
		expect(onsubmit).not.toHaveBeenCalled();
		expect(screen.getByLabelText('Email')).toHaveAccessibleDescription(
			'Enter a valid email address.'
		);
		expect(screen.getByLabelText('Password')).toHaveAttribute('aria-invalid', 'true');
	});

	it('shows the server rejection', async () => {
		const onsubmit = vi.fn(async () => {
			throw new AppError('UNAUTHORIZED', 'Invalid credentials');
		});
		render(AuthForm, { mode: 'signIn', onsubmit });
		await fill('Email', 'ada@nemmail.example');
		await fill('Password', 'wrong-password');
		await fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
		expect(await screen.findByRole('alert')).toHaveTextContent('Wrong email or password.');
	});
});
