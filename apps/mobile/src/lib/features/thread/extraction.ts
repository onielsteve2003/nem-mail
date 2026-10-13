import type { Extraction } from '@nem/shared';

/** A meeting without an end time gets this long in the calendar. */
const MEETING_MINUTES = 30;

/**
 * An iCalendar file for a date or meeting chip (RFC 5545). Times are floating
 * (no time zone), so the event lands at the written time wherever it opens.
 */
export function buildIcs(item: Extraction, title: string, now = new Date()): string {
	const [day = '', time] = item.value.split('T');
	const date = day.replaceAll('-', '');
	const lines = [
		'BEGIN:VCALENDAR',
		'VERSION:2.0',
		'PRODID:-//Nem Mail//Smart extraction//EN',
		'BEGIN:VEVENT',
		`UID:${date}${time?.replace(':', '') ?? ''}-${now.getTime()}@nem-mail`,
		`DTSTAMP:${now
			.toISOString()
			.replace(/[-:]/g, '')
			.replace(/\.\d{3}/, '')}`
	];
	const [year = 0, month = 1, dayOfMonth = 1] = day.split('-').map(Number);
	if (time) {
		const [hour = 0, minute = 0] = time.split(':').map(Number);
		const start = new Date(year, month - 1, dayOfMonth, hour, minute);
		const end = new Date(start.getTime() + MEETING_MINUTES * 60_000);
		lines.push(`DTSTART:${icsLocal(start)}`, `DTEND:${icsLocal(end)}`);
	} else {
		// All-day events end on the next day (DTEND is exclusive).
		const next = new Date(year, month - 1, dayOfMonth + 1);
		lines.push(`DTSTART;VALUE=DATE:${date}`, `DTEND;VALUE=DATE:${icsLocal(next).slice(0, 8)}`);
	}
	lines.push(`SUMMARY:${escapeIcs(title)}`, 'END:VEVENT', 'END:VCALENDAR');
	return lines.join('\r\n') + '\r\n';
}

/** The carrier's own tracking page when the number shows it, else a free multi-carrier lookup. */
export function trackingUrl(number: string): string {
	const id = encodeURIComponent(number);
	if (/^1Z[0-9A-Z]{16}$/.test(number)) return `https://www.ups.com/track?tracknum=${id}`;
	if (/^9[2-5]\d{18,20}$/.test(number)) {
		return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${id}`;
	}
	return `https://parcelsapp.com/en/tracking/${id}`;
}

/** "Fri 16 Oct, 15:00" for a chip (local, short). */
export function whenLabel(value: string, locale?: string): string {
	const [day = '', time] = value.split('T');
	const date = new Date(`${day}T${time ?? '00:00'}`);
	const dayText = date.toLocaleDateString(locale, {
		weekday: 'short',
		day: 'numeric',
		month: 'short'
	});
	return time ? `${dayText}, ${time}` : dayText;
}

function icsLocal(date: Date): string {
	const pad = (value: number) => String(value).padStart(2, '0');
	return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(date.getHours())}${pad(date.getMinutes())}00`;
}

function escapeIcs(text: string): string {
	return text.replace(/[\\;,]/g, (char) => `\\${char}`).replace(/\r?\n/g, '\\n');
}
