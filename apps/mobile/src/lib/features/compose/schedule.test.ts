import { describe, expect, it } from 'vitest';
import { fromLocalIso, isValidSendAt, schedulePresets, toLocalIso } from './schedule.js';

describe('schedulePresets', () => {
	it('gives tomorrow 8:00 and 13:00 and next Monday 8:00', () => {
		// Wednesday 2026-10-14 15:30 local.
		const now = new Date(2026, 9, 14, 15, 30);
		const [morning, afternoon, monday] = schedulePresets(now);
		expect(morning?.at).toEqual(new Date(2026, 9, 15, 8, 0));
		expect(afternoon?.at).toEqual(new Date(2026, 9, 15, 13, 0));
		expect(monday?.at).toEqual(new Date(2026, 9, 19, 8, 0));
	});

	it('picks the following Monday when today is Monday', () => {
		const now = new Date(2026, 9, 12, 7, 0);
		expect(schedulePresets(now)[2]?.at).toEqual(new Date(2026, 9, 19, 8, 0));
	});
});

describe('custom send time', () => {
	const now = new Date(2026, 9, 12, 10, 0);

	it('needs at least a minute of lead time', () => {
		expect(isValidSendAt(new Date(2026, 9, 12, 10, 0, 30), now)).toBe(false);
		expect(isValidSendAt(new Date(2026, 9, 12, 9, 0), now)).toBe(false);
		expect(isValidSendAt(new Date(2026, 9, 12, 10, 1), now)).toBe(true);
		expect(isValidSendAt(new Date(Number.NaN), now)).toBe(false);
	});

	it('round-trips local ISO for ion-datetime', () => {
		const at = new Date(2026, 0, 5, 9, 7);
		expect(toLocalIso(at)).toBe('2026-01-05T09:07');
		expect(fromLocalIso('2026-01-05T09:07:00')).toEqual(at);
		expect(fromLocalIso('')).toBeNull();
		expect(fromLocalIso(['2026-01-05'])).toBeNull();
		expect(fromLocalIso('nope')).toBeNull();
	});
});
