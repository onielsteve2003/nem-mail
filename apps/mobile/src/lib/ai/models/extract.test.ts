import { describe, expect, it } from 'vitest';
import { extract } from './extract';

// Tuesday 13 October 2026, 10:00 local time.
const SENT = new Date(2026, 9, 13, 10, 0).toISOString();
const run = (subject: string, text: string) => extract({ subject, text, sentAt: SENT });

describe('extract', () => {
	it('finds a one-time code named before or after the digits', () => {
		expect(run('Your verification code', 'Your Northbank code is 482913.')?.value).toEqual([
			{ kind: 'otp', text: '482913', value: '482913' }
		]);
		expect(run('Sign in', '7731 is your login code.')?.value[0]?.value).toBe('7731');
	});

	it('does not read a booking reference or an order number as a code', () => {
		expect(run('Trip confirmed', 'Booking reference 551203.')).toBeNull();
		expect(run('Receipt for order #4410', 'You paid $20.')).toBeNull();
	});

	it('finds labelled and UPS tracking numbers', () => {
		expect(run('Shipped', 'Tracking number: PX1234567890')?.value[0]).toEqual({
			kind: 'tracking',
			text: 'PX1234567890',
			value: 'PX1234567890'
		});
		expect(run('Shipped', 'Your parcel 1Z999AA10123456784 is out.')?.value[0]?.value).toBe(
			'1Z999AA10123456784'
		);
	});

	it('resolves weekdays after the send day and reads a meeting time', () => {
		const verdict = run('Invitation: Atlas sync on Friday at 15:00', 'When: Friday at 15:00.');
		expect(verdict?.value).toEqual([
			{ kind: 'meeting', text: 'Friday at 15:00', value: '2026-10-16T15:00' }
		]);
		// Sent on a Tuesday, "Tuesday" means next week.
		expect(run('Deadline', 'I have a deadline on Tuesday.')?.value[0]?.value).toBe('2026-10-20');
	});

	it('reads month names, 12-hour times, and rolls past dates into next year', () => {
		expect(run('Call', 'Can we have a call on Oct 20 at 3pm?')?.value[0]).toMatchObject({
			kind: 'meeting',
			value: '2026-10-20T15:00'
		});
		expect(run('Renewal', 'Your plan renews on 5 March.')?.value[0]).toMatchObject({
			kind: 'date',
			value: '2027-03-05'
		});
		expect(run('Oops', 'See you on February 30.')).toBeNull();
	});

	it('ignores quoted text and explains the result', () => {
		const verdict = run('Re: hi', 'Thanks!\n\nOn Mon, Ada wrote:\n> Your code is 123456');
		expect(verdict).toBeNull();
		const code = run('Code', 'Your code is 123456. Tracking number: PX99887766')!;
		expect(code.source).toBe('heuristic');
		expect(code.explanation).toBe(
			'Found a one-time code and a tracking number by pattern matching on this device.'
		);
	});
});
