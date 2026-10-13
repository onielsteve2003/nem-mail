import { describe, expect, it } from 'vitest';
import { buildIcs, trackingUrl } from './extraction';

const NOW = new Date(Date.UTC(2026, 9, 13, 9, 30));

describe('buildIcs', () => {
	it('makes a 30-minute event for a meeting time, in floating local time', () => {
		const ics = buildIcs(
			{ kind: 'meeting', text: 'Friday at 15:00', value: '2026-10-16T15:00' },
			'Atlas sync; weekly',
			NOW
		);
		expect(ics).toContain('DTSTART:20261016T150000\r\n');
		expect(ics).toContain('DTEND:20261016T153000\r\n');
		expect(ics).toContain('SUMMARY:Atlas sync\\; weekly\r\n');
		expect(ics).toContain('DTSTAMP:20261013T093000Z\r\n');
	});

	it('makes an all-day event for a date, ending the next day', () => {
		const ics = buildIcs({ kind: 'date', text: 'Oct 31', value: '2026-10-31' }, 'Renewal', NOW);
		expect(ics).toContain('DTSTART;VALUE=DATE:20261031\r\n');
		expect(ics).toContain('DTEND;VALUE=DATE:20261101\r\n');
	});
});

describe('trackingUrl', () => {
	it('links UPS numbers to UPS and others to a multi-carrier lookup', () => {
		expect(trackingUrl('1Z999AA10123456784')).toBe(
			'https://www.ups.com/track?tracknum=1Z999AA10123456784'
		);
		expect(trackingUrl('PX1234567890')).toBe('https://parcelsapp.com/en/tracking/PX1234567890');
	});
});
