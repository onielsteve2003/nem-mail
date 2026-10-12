import { describe, expect, it } from 'vitest';
import { guardRedirect } from './guard.js';

describe('guardRedirect', () => {
	it('sends signed-out visitors to onboarding', () => {
		expect(guardRedirect('/', false)).toBe('/onboarding');
		expect(guardRedirect('/mail/inbox', false)).toBe('/onboarding');
		expect(guardRedirect('/settings', false)).toBe('/onboarding');
		expect(guardRedirect('/onboarding', false)).toBeNull();
	});

	it('sends signed-in users past onboarding to the Inbox', () => {
		expect(guardRedirect('/', true)).toBe('/mail/inbox');
		expect(guardRedirect('/onboarding', true)).toBe('/mail/inbox');
		expect(guardRedirect('/mail/starred', true)).toBeNull();
		expect(guardRedirect('/mail/thread/t1', true)).toBeNull();
	});

	it('leaves the dev gallery open either way', () => {
		expect(guardRedirect('/dev/gallery', false)).toBeNull();
		expect(guardRedirect('/dev/gallery', true)).toBeNull();
	});
});
