const MORNING_HOUR = 8;
const AFTERNOON_HOUR = 13;
const MONDAY = 1;
/** A custom time must be at least this far ahead, so it is not already due when sent. */
export const MIN_SCHEDULE_LEAD_MS = 60_000;

export interface SchedulePreset {
	id: string;
	label: string;
	at: Date;
}

/** Schedule send presets (FR-5.7): tomorrow morning and afternoon, and next Monday morning. */
export function schedulePresets(now: Date): SchedulePreset[] {
	const morning = new Date(now);
	morning.setDate(morning.getDate() + 1);
	morning.setHours(MORNING_HOUR, 0, 0, 0);
	const afternoon = new Date(morning);
	afternoon.setHours(AFTERNOON_HOUR);
	const monday = new Date(now);
	monday.setDate(monday.getDate() + ((MONDAY - monday.getDay() + 7) % 7 || 7));
	monday.setHours(MORNING_HOUR, 0, 0, 0);
	return [
		{ id: 'tomorrow-morning', label: 'Tomorrow morning', at: morning },
		{ id: 'tomorrow-afternoon', label: 'Tomorrow afternoon', at: afternoon },
		{ id: 'monday-morning', label: 'Monday morning', at: monday }
	];
}

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

/** Whether a custom send time is far enough in the future. */
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
