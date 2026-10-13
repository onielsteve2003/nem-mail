import { DEFAULT_SETTINGS } from '@nem/shared';
import { describe, expect, it } from 'vitest';
import {
	autoReplySubject,
	fromDateInput,
	toDateInput,
	vacationRangeError,
	vacationStatus,
	type Vacation
} from './account.js';

const NOW = new Date(2026, 9, 13, 12).getTime();
const vacation = (patch: Partial<Vacation>): Vacation => ({
	...DEFAULT_SETTINGS.vacation,
	enabled: true,
	...patch
});

describe('vacation dates', () => {
	it('round-trips a date input through whole local days', () => {
		const start = fromDateInput('2026-10-20', 'start');
		const end = fromDateInput('2026-10-20', 'end');
		expect(toDateInput(start)).toBe('2026-10-20');
		expect(toDateInput(end)).toBe('2026-10-20');
		expect(Date.parse(end!) - Date.parse(start!)).toBe(86_400_000 - 1);
		expect(fromDateInput('', 'start')).toBeNull();
		expect(toDateInput(null)).toBe('');
	});

	it('reports when the responder answers mail', () => {
		const day = (offset: number) => new Date(NOW + offset * 86_400_000).toISOString();
		expect(vacationStatus(vacation({ enabled: false }), NOW)).toBe('off');
		expect(vacationStatus(vacation({}), NOW)).toBe('active');
		expect(vacationStatus(vacation({ startsAt: day(2) }), NOW)).toBe('scheduled');
		expect(vacationStatus(vacation({ startsAt: day(-2), endsAt: day(-1) }), NOW)).toBe('ended');
		expect(vacationStatus(vacation({ startsAt: day(-1), endsAt: day(1) }), NOW)).toBe('active');
	});

	it('rejects a last day before the first day', () => {
		const range = (start: string, end: string) =>
			vacation({ startsAt: fromDateInput(start, 'start'), endsAt: fromDateInput(end, 'end') });
		expect(vacationRangeError(range('2026-10-20', '2026-10-19'))).not.toBeNull();
		expect(vacationRangeError(range('2026-10-20', '2026-10-20'))).toBeNull();
	});

	it('uses the written subject, or replies to the incoming one', () => {
		expect(autoReplySubject(vacation({ subject: 'Away' }), 'Lunch?')).toBe('Away');
		expect(autoReplySubject(vacation({ subject: ' ' }), 'Lunch?')).toBe('Re: Lunch?');
	});
});
