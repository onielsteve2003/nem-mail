import { describe, expect, it } from 'vitest';
import { addRecipients, parseRecipient, parseRecipients, toAddresses } from './recipients.js';

describe('parseRecipient', () => {
	it('reads bare and named addresses, lowercasing the email', () => {
		expect(parseRecipient(' Ada@Example.com ')).toEqual({
			email: 'ada@example.com',
			isValid: true
		});
		expect(parseRecipient('Ada Lovelace <ada@example.com>')).toEqual({
			email: 'ada@example.com',
			name: 'Ada Lovelace',
			isValid: true
		});
		expect(parseRecipient('"Lovelace, Ada" <ada@example.com>')?.name).toBe('Lovelace, Ada');
	});

	it('flags invalid entries and skips blanks', () => {
		expect(parseRecipient('not-an-email')).toEqual({ email: 'not-an-email', isValid: false });
		expect(parseRecipient('   ')).toBeNull();
	});
});

describe('parseRecipients', () => {
	it('splits pasted lists on commas, semicolons and newlines but not inside quotes', () => {
		const list = parseRecipients('a@x.com; "Doe, Jo" <jo@x.com>,\nbad,, c@x.com');
		expect(list.map((r) => [r.email, r.isValid])).toEqual([
			['a@x.com', true],
			['jo@x.com', true],
			['bad', false],
			['c@x.com', true]
		]);
	});
});

describe('addRecipients and toAddresses', () => {
	it('skips duplicates and keeps only valid addresses for the draft', () => {
		const list = addRecipients(
			parseRecipients('a@x.com'),
			parseRecipients('A@x.com, bad, b@x.com')
		);
		expect(list.map((r) => r.email)).toEqual(['a@x.com', 'bad', 'b@x.com']);
		expect(toAddresses(list)).toEqual([{ email: 'a@x.com' }, { email: 'b@x.com' }]);
	});
});
