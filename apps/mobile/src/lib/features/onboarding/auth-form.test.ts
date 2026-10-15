import { describe, expect, it } from 'vitest';
import { AppError } from '@nem/shared';
import { authErrorMessage, checkAuthForm } from './auth-form.js';

describe('checkAuthForm', () => {
	it('returns the trimmed request when sign-up is valid', () => {
		const check = checkAuthForm('signUp', {
			name: '  Ada ',
			email: 'ada@nemmail.example',
			password: 'analytical'
		});
		expect(check).toEqual({
			ok: true,
			request: { name: 'Ada', email: 'ada@nemmail.example', password: 'analytical' }
		});
	});

	it('gives one message per invalid sign-up field', () => {
		const check = checkAuthForm('signUp', { name: ' ', email: 'ada', password: 'short' });
		expect(check).toEqual({
			ok: false,
			errors: {
				name: 'Enter your name.',
				email: 'Enter a valid email address.',
				password: 'Use at least 8 characters.'
			}
		});
	});

	it('ignores the name when signing in', () => {
		expect(
			checkAuthForm('signIn', { name: '', email: 'ada@nemmail.example', password: '' })
		).toEqual({
			ok: false,
			errors: { password: 'Enter your password.' }
		});
		expect(
			checkAuthForm('signIn', { name: '', email: 'ada@nemmail.example', password: 'analytical' })
		).toEqual({ ok: true, request: { email: 'ada@nemmail.example', password: 'analytical' } });
	});
});

describe('authErrorMessage', () => {
	it('words wrong credentials and taken emails for the form', () => {
		const unauthorized = new AppError('UNAUTHORIZED', 'Invalid credentials');
		expect(authErrorMessage('signIn', unauthorized)).toBe('Wrong email or password.');
		expect(authErrorMessage('signUp', new AppError('CONFLICT', 'taken'))).toMatch(/already exists/);
		expect(authErrorMessage('signIn', new AppError('NETWORK', 'down'))).toMatch(/connect/);
	});
});
