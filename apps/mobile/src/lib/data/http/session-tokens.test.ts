import { describe, expect, it } from 'vitest';
import type { SessionResponse } from '@nem/shared';
import { SESSIONS_KEY, SessionTokens, type TokenStorage } from './session-tokens.js';

const NOW = Date.parse('2026-10-13T12:00:00.000Z');
const DAY = 86_400_000;

function memoryStorage(initial: Record<string, string> = {}): TokenStorage & {
	data: Record<string, string>;
} {
	const data = { ...initial };
	return {
		data,
		getItem: (key) => data[key] ?? null,
		setItem: (key, value) => {
			data[key] = value;
		},
		removeItem: (key) => {
			delete data[key];
		}
	};
}

function session(id: string, token = `token-${id}`, days = 30): SessionResponse {
	return {
		token,
		expiresAt: new Date(NOW + days * DAY).toISOString(),
		user: {
			id,
			email: `${id}@nemmail.example`,
			name: id.toUpperCase(),
			avatarSeed: id,
			createdAt: '2026-01-01T00:00:00.000Z'
		}
	};
}

describe('SessionTokens', () => {
	it('starts signed out', () => {
		const tokens = new SessionTokens(memoryStorage(), () => NOW);

		expect(tokens.token).toBeNull();
		expect(tokens.activeId).toBeNull();
		expect(tokens.accounts()).toEqual([]);
	});

	it('keeps one token per account and makes the newest active', () => {
		const tokens = new SessionTokens(memoryStorage(), () => NOW);
		tokens.add(session('ada'));
		const grace = tokens.add(session('grace'));

		expect(tokens.token).toBe('token-grace');
		expect(grace).toEqual({
			id: 'grace',
			email: 'grace@nemmail.example',
			name: 'GRACE',
			avatarSeed: 'grace',
			signedInAt: new Date(NOW).toISOString()
		});
		expect(tokens.accounts().map((a) => a.id)).toEqual(['ada', 'grace']);
	});

	it('switches accounts locally and rejects one not signed in', () => {
		const tokens = new SessionTokens(memoryStorage(), () => NOW);
		tokens.add(session('ada'));
		tokens.add(session('grace'));

		expect(tokens.switchTo('ada').id).toBe('ada');
		expect(tokens.token).toBe('token-ada');
		expect(() => tokens.switchTo('nobody')).toThrow(expect.objectContaining({ code: 'NOT_FOUND' }));
	});

	it('signing in again replaces the token and keeps the place and first sign-in time', () => {
		let now = NOW;
		const tokens = new SessionTokens(memoryStorage(), () => now);
		tokens.add(session('ada'));
		tokens.add(session('grace'));
		now += DAY;
		tokens.add(session('ada', 'fresh'));

		expect(tokens.token).toBe('fresh');
		expect(tokens.accounts().map((a) => a.id)).toEqual(['ada', 'grace']);
		expect(tokens.accounts()[0]?.signedInAt).toBe(new Date(NOW).toISOString());
	});

	it('removing the active account falls back to the next one, then to signed out', () => {
		const tokens = new SessionTokens(memoryStorage(), () => NOW);
		tokens.add(session('ada'));
		tokens.add(session('grace'));
		tokens.switchTo('ada');

		expect(tokens.remove('grace')).toBe('ada');
		expect(tokens.remove('ada')).toBeNull();
		expect(tokens.token).toBeNull();
	});

	it('persists across restarts and clears storage when the last account leaves', () => {
		const storage = memoryStorage();
		const first = new SessionTokens(storage, () => NOW);
		first.add(session('ada'));
		first.add(session('grace'));
		first.switchTo('ada');

		const restarted = new SessionTokens(storage, () => NOW);
		expect(restarted.token).toBe('token-ada');
		expect(restarted.accounts()).toHaveLength(2);

		restarted.remove('ada');
		restarted.remove('grace');
		expect(storage.data[SESSIONS_KEY]).toBeUndefined();
	});

	it('drops expired sessions on start and moves to a live account', () => {
		const storage = memoryStorage();
		const tokens = new SessionTokens(storage, () => NOW);
		tokens.add(session('grace', 'token-grace', 30));
		tokens.add(session('ada', 'token-ada', 1));

		const later = new SessionTokens(storage, () => NOW + 2 * DAY);
		expect(later.activeId).toBe('grace');
		expect(later.accounts().map((a) => a.id)).toEqual(['grace']);
	});

	it('treats corrupt, tampered or blocked storage as signed out', () => {
		const blocked: TokenStorage = {
			getItem: () => {
				throw new Error('SecurityError');
			},
			setItem: () => {
				throw new Error('SecurityError');
			},
			removeItem: () => {}
		};

		expect(new SessionTokens(memoryStorage({ [SESSIONS_KEY]: '{oops' })).token).toBeNull();
		expect(
			new SessionTokens(memoryStorage({ [SESSIONS_KEY]: '{"activeId":"x","sessions":[{}]}' })).token
		).toBeNull();
		const tokens = new SessionTokens(blocked, () => NOW);
		tokens.add(session('ada'));
		expect(tokens.token).toBe('token-ada');
	});

	it('refreshes the stored profile after /me', () => {
		const tokens = new SessionTokens(memoryStorage(), () => NOW);
		const { user } = session('ada');
		tokens.add(session('ada'));
		tokens.updateUser({ ...user, name: 'Ada Lovelace' });

		expect(tokens.accounts()[0]).toMatchObject({
			name: 'Ada Lovelace',
			signedInAt: new Date(NOW).toISOString()
		});
	});
});
