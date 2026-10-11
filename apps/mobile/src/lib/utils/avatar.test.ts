import { describe, expect, it } from 'vitest';
import { AVATAR_BASE_COLORS, getAvatarPalette, getInitials, hashString } from './avatar.js';

describe('hashString', () => {
	it('is stable and spreads similar strings', () => {
		expect(hashString('Ada Lovelace')).toBe(hashString('Ada Lovelace'));
		expect(hashString('Ada')).not.toBe(hashString('Adb'));
		expect(hashString('')).toBeGreaterThanOrEqual(0);
	});
});

describe('getInitials', () => {
	it.each([
		['Ada Lovelace', 'AL'],
		['ada', 'A'],
		['Grace Brewster Murray Hopper', 'GH'],
		['  jean-luc   picard ', 'JP'],
		['linus.torvalds@example.com', 'LT'],
		['noreply@example.com', 'N'],
		['Émile Zola', 'ÉZ'],
		['(GitHub)', 'G'],
		['', '?'],
		['@@@', '?']
	])('%j → %s', (name, initials) => {
		expect(getInitials(name)).toBe(initials);
	});
});

describe('getAvatarPalette', () => {
	const names = Array.from({ length: 200 }, (_, i) => `Sender ${i}`);

	it('is deterministic and ignores case and padding', () => {
		expect(getAvatarPalette('Ada Lovelace')).toEqual(getAvatarPalette('  ada lovelace '));
	});

	it('always uses two different readable base colors', () => {
		for (const name of names) {
			const { from, to } = getAvatarPalette(name);
			expect(from).not.toBe(to);
			expect(AVATAR_BASE_COLORS).toContain(from);
			expect(AVATAR_BASE_COLORS).toContain(to);
		}
	});

	it('keeps the blob in a corner and the angle in range', () => {
		for (const name of names) {
			const { angle, blobX, blobY } = getAvatarPalette(name);
			expect(angle).toBeGreaterThanOrEqual(0);
			expect(angle).toBeLessThan(360);
			for (const pos of [blobX, blobY]) {
				expect(pos <= 25 || pos >= 75).toBe(true);
				expect(pos).toBeLessThanOrEqual(100);
			}
		}
	});

	it('varies across names', () => {
		const combos = new Set(names.map((n) => JSON.stringify(getAvatarPalette(n))));
		expect(combos.size).toBeGreaterThan(150);
	});
});
