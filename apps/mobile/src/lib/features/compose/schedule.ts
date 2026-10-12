import type { TimePreset } from '#lib/utils/time-picker.js';

export {
	MIN_SCHEDULE_LEAD_MS,
	fromLocalIso,
	isValidSendAt,
	scheduleTime,
	toLocalIso,
	yearsAhead
} from '#lib/utils/time-picker.js';

const MORNING_HOUR = 8;
const AFTERNOON_HOUR = 13;
const MONDAY = 1;

/** Schedule send presets (FR-5.7): tomorrow morning and afternoon, and next Monday morning. */
export function schedulePresets(now: Date): TimePreset[] {
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
