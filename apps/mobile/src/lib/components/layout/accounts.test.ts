import type { Account } from '@nem/shared';
import { DEMO_EMAIL, DEMO_WORK_EMAIL } from '@nem/shared';
import { describe, expect, it } from 'vitest';
import { nextDemoEmail } from './accounts.js';

const account = (email: string): Account => ({
	id: email,
	email,
	name: 'Alex',
	avatarSeed: email,
	signedInAt: '2026-10-12T00:00:00.000Z'
});

describe('nextDemoEmail', () => {
	it('offers the first demo account that is not signed in', () => {
		expect(nextDemoEmail([])).toBe(DEMO_EMAIL);
		expect(nextDemoEmail([account(DEMO_EMAIL)])).toBe(DEMO_WORK_EMAIL);
		expect(nextDemoEmail([account(DEMO_WORK_EMAIL.toUpperCase())])).toBe(DEMO_EMAIL);
	});

	it('returns null when every demo account is on the device', () => {
		expect(nextDemoEmail([account(DEMO_EMAIL), account(DEMO_WORK_EMAIL)])).toBeNull();
	});
});
