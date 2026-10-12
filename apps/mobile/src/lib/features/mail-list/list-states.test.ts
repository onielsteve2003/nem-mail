import { SYSTEM_MAILBOXES } from '@nem/shared';
import { describe, expect, it } from 'vitest';
import { emptyCopy, errorCopy } from './list-states.js';

describe('list states', () => {
	it('has distinct empty copy for every mailbox and for labels', () => {
		const titles = [...SYSTEM_MAILBOXES.map((m) => emptyCopy(m).title), emptyCopy(null).title];
		expect(new Set(titles).size).toBe(titles.length);
	});

	it('words errors differently when offline', () => {
		expect(errorCopy(true).illustration).toBe('offline');
		expect(errorCopy(false).illustration).toBe('error');
	});
});
