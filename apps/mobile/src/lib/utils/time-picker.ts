/** A preset in a time picker sheet: schedule send, snooze. */
export interface TimePreset {
	id: string;
	label: string;
	at: Date;
}

/** A custom time must be at least this far ahead, so it is not already due when it lands. */
export const MIN_SCHEDULE_LEAD_MS = 60_000;

/** "Tue, Oct 13, 8:00 AM"; the year is added when it is not this year. */
export function scheduleTime(at: Date, now: Date): string {
	return at.toLocaleString(undefined, {
		weekday: 'short',
		month: 'short',
		day: 'numeric',
		hour: 'numeric',
		minute: '2-digit',
		...(at.getFullYear() !== now.getFullYear() && { year: 'numeric' })
	});
}

/** Whether a custom time is far enough in the future. */
export function isValidSendAt(at: Date, now: Date): boolean {
	return !Number.isNaN(at.getTime()) && at.getTime() - now.getTime() >= MIN_SCHEDULE_LEAD_MS;
}

/** The same moment `years` from now; bounds the custom picker. */
export function yearsAhead(now: Date, years: number): Date {
	const end = new Date(now);
	end.setFullYear(end.getFullYear() + years);
	return end;
}

/** Local "YYYY-MM-DDTHH:mm" with no offset, which ion-datetime reads and writes. */
export function toLocalIso(at: Date): string {
	const pad = (n: number) => String(n).padStart(2, '0');
	return (
		`${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}` +
		`T${pad(at.getHours())}:${pad(at.getMinutes())}`
	);
}

/** Reads ion-datetime's value (local time, no offset); null when empty or invalid. */
export function fromLocalIso(value: string | string[] | null | undefined): Date | null {
	if (typeof value !== 'string' || !value) return null;
	// Without an offset, Date parses date-time strings as local time.
	const at = new Date(value.slice(0, 16));
	return Number.isNaN(at.getTime()) ? null : at;
}
