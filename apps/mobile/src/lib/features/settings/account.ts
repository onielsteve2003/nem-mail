import type { Settings } from '@nem/shared';

export type Vacation = Settings['vacation'];
export type VacationStatus = 'off' | 'scheduled' | 'active' | 'ended';

const pad = (value: number) => String(value).padStart(2, '0');

/** An ISO time as the `YYYY-MM-DD` a date input shows, in local time. Empty for none. */
export function toDateInput(iso: string | null): string {
	if (!iso) return '';
	const date = new Date(iso);
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * A date input's `YYYY-MM-DD` as an ISO time: the start of that local day for the
 * first day, the end of it for the last day, so the whole day counts. Null when empty.
 */
export function fromDateInput(value: string, edge: 'start' | 'end'): string | null {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
	if (!match) return null;
	const [year, month, day] = [Number(match[1]), Number(match[2]) - 1, Number(match[3])];
	const date =
		edge === 'start'
			? new Date(year, month, day, 0, 0, 0, 0)
			: new Date(year, month, day, 23, 59, 59, 999);
	return date.toISOString();
}

/** Whether the responder answers mail now. No first day means from now; no last day, until off. */
export function vacationStatus(vacation: Vacation, now = Date.now()): VacationStatus {
	if (!vacation.enabled) return 'off';
	if (vacation.startsAt && Date.parse(vacation.startsAt) > now) return 'scheduled';
	if (vacation.endsAt && Date.parse(vacation.endsAt) < now) return 'ended';
	return 'active';
}

/** A message for a last day before the first day, or null when the range is fine. */
export function vacationRangeError(vacation: Vacation): string | null {
	const { startsAt, endsAt } = vacation;
	if (startsAt && endsAt && Date.parse(endsAt) < Date.parse(startsAt)) {
		return 'The last day is before the first day.';
	}
	return null;
}

/** The subject senders get: the one the user wrote, or a reply to theirs. */
export function autoReplySubject(vacation: Vacation, incoming: string): string {
	return vacation.subject.trim() || `Re: ${incoming}`;
}
