import type { AIInsight, Extraction } from '@nem/shared';
import { ownText } from './textrank.js';

/** The message to look through. */
export interface ExtractInput {
	subject: string;
	text: string;
	/** When it was sent (ISO): "Friday" means the Friday after this. */
	sentAt: string;
}

export type ExtractionVerdict = AIInsight<Extraction[]>;

/** At most this many chips, so the row stays one glance. */
export const MAX_EXTRACTIONS = 4;

const CONFIDENCE: Record<Extraction['kind'], number> = {
	otp: 0.9,
	tracking: 0.85,
	meeting: 0.8,
	date: 0.7
};
const KIND_NAMES: Record<Extraction['kind'], string> = {
	otp: 'a one-time code',
	tracking: 'a tracking number',
	meeting: 'a meeting time',
	date: 'a date'
};

// A code is 4 to 8 digits next to a word that names it ("Your code is 123456",
// "123456 is your verification code"). A booking reference or order number is not.
const OTP_AFTER = /\b(?:code|passcode|otp|pin)\b[^\d\n]{0,25}?\b(\d{4,8})\b/i;
const OTP_BEFORE =
	/\b(\d{4,8})\b[^\d\n]{0,20}\b(?:verification|security|login|one-time)?\s*code\b/i;
const TRACKING_LABEL =
	/\btracking\s*(?:number|no\.?|#|id|code)?\s*[:#]?\s*([A-Z0-9][A-Z0-9-]{7,29})\b/i;
const UPS = /\b1Z[0-9A-Z]{16}\b/;

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MONTH = String.raw`(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?`;
const DATE_PATTERNS: RegExp[] = [
	/\b(\d{4})-(\d{2})-(\d{2})\b/gi,
	new RegExp(String.raw`\b${MONTH}\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?\b`, 'gi'),
	new RegExp(String.raw`\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?${MONTH}(?:,?\s+(\d{4}))?\b`, 'gi'),
	/\b(today|tomorrow|(?:next\s+)?(?:sun|mon|tues|wednes|thurs|fri|satur)day)\b/gi
];
// A time needs a colon or am/pm, so "3 people" is not a time.
const TIME =
	/^[^.!?\n]{0,12}?\b(?:(\d{1,2}):(\d{2})\s*([ap]\.?m\.?)?|(\d{1,2})\s*([ap]\.?m\.?))(?![\w:])/i;
const MEETING_WORDS =
	/\b(meet|meeting|call|sync|interview|lunch|dinner|coffee|appointment|invit\w*|calendar|standup|demo)\b/i;

/** Finds codes, tracking numbers, dates, and meeting times in a message (AI-10). Null when none. */
export function extract(input: ExtractInput): ExtractionVerdict | null {
	const text = `${input.subject}\n${ownText(input.text)}`;
	const sent = new Date(input.sentAt);
	const found: Extraction[] = [];
	const add = (item: Extraction): void => {
		if (!found.some((other) => other.kind === item.kind && other.value === item.value)) {
			found.push(item);
		}
	};

	const otp = OTP_AFTER.exec(text) ?? OTP_BEFORE.exec(text);
	if (otp?.[1]) add({ kind: 'otp', text: otp[1], value: otp[1] });

	const tracking = UPS.exec(text) ?? TRACKING_LABEL.exec(text);
	const number = (tracking?.[1] ?? tracking?.[0])?.toUpperCase();
	if (tracking && number && /\d/.test(number))
		add({ kind: 'tracking', text: number, value: number });

	for (const item of findDates(text, sent)) add(item);

	if (found.length === 0) return null;
	const value = found.slice(0, MAX_EXTRACTIONS);
	const kinds = [...new Set(value.map((item) => item.kind))];
	return {
		value,
		confidence: Math.max(...kinds.map((kind) => CONFIDENCE[kind])),
		explanation: `Found ${listNames(kinds.map((kind) => KIND_NAMES[kind]))} by pattern matching on this device.`,
		source: 'heuristic'
	};
}

function findDates(text: string, sent: Date): Extraction[] {
	const hits: { index: number; item: Extraction }[] = [];
	for (const pattern of DATE_PATTERNS) {
		for (const match of text.matchAll(pattern)) {
			const day = resolveDay(match, sent);
			if (!day) continue;
			const end = match.index + match[0].length;
			const time = parseTime(text.slice(end));
			const isMeeting = time !== null && MEETING_WORDS.test(sentenceAround(text, match.index));
			hits.push({
				index: match.index,
				item: {
					kind: isMeeting ? 'meeting' : 'date',
					text: text.slice(match.index, end + (time?.length ?? 0)).trim(),
					value: time ? `${isoDate(day)}T${time.value}` : isoDate(day)
				}
			});
		}
	}
	// In reading order; one chip per day, keeping the one with a time.
	hits.sort((a, b) => a.index - b.index);
	const byDay = new Map<string, Extraction>();
	for (const { item } of hits) {
		const day = item.value.slice(0, 10);
		const kept = byDay.get(day);
		if (!kept || (!kept.value.includes('T') && item.value.includes('T'))) byDay.set(day, item);
	}
	return [...byDay.values()];
}

/** The calendar day a date match names, in local time; null for an impossible date. */
function resolveDay(match: RegExpMatchArray, sent: Date): Date | null {
	const today = new Date(sent.getFullYear(), sent.getMonth(), sent.getDate());
	const [, a = '', b = '', c] = match;
	if (/^\d{4}$/.test(a)) return makeDate(Number(a), Number(b) - 1, Number(c));
	const word = a.toLowerCase();
	if (word === 'today') return today;
	if (word === 'tomorrow') return addDays(today, 1);
	const weekday = WEEKDAYS.indexOf(word.replace(/^next\s+/, ''));
	if (weekday >= 0) {
		// The next one after the send day: "Friday" sent on a Friday means a week on.
		const ahead = (weekday - today.getDay() + 7) % 7 || 7;
		return addDays(today, ahead);
	}
	const monthFirst = MONTHS.indexOf(word.slice(0, 3));
	const month = monthFirst >= 0 ? monthFirst : MONTHS.indexOf(b.toLowerCase().slice(0, 3));
	const dayOfMonth = Number(monthFirst >= 0 ? b : a);
	if (month < 0) return null;
	if (c) return makeDate(Number(c), month, dayOfMonth);
	// No year: the next time that day comes round.
	const thisYear = makeDate(today.getFullYear(), month, dayOfMonth);
	if (thisYear && thisYear < today) return makeDate(today.getFullYear() + 1, month, dayOfMonth);
	return thisYear;
}

/** "HH:mm" for a time just after a date ("at 3pm", ", 15:00"), and how much text it took. */
function parseTime(after: string): { value: string; length: number } | null {
	const match = TIME.exec(after);
	if (!match) return null;
	const [, hh, mm, colonMeridiem, bareHour, bareMeridiem] = match;
	let hour = Number(hh ?? bareHour);
	const minute = Number(mm ?? 0);
	const meridiem = (colonMeridiem ?? bareMeridiem ?? '').toLowerCase().replace(/\./g, '');
	if (meridiem === 'pm' && hour < 12) hour += 12;
	if (meridiem === 'am' && hour === 12) hour = 0;
	if (hour > 23 || minute > 59) return null;
	return { value: `${pad(hour)}:${pad(minute)}`, length: match[0].length };
}

function sentenceAround(text: string, index: number): string {
	const start = Math.max(text.lastIndexOf('\n', index), text.lastIndexOf('. ', index), 0);
	const rest = text.slice(index).search(/[.!?\n]/);
	return text.slice(start, rest < 0 ? undefined : index + rest);
}

function makeDate(year: number, month: number, day: number): Date | null {
	const date = new Date(year, month, day);
	return date.getMonth() === month && date.getDate() === day ? date : null;
}

function addDays(date: Date, days: number): Date {
	return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function isoDate(date: Date): string {
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function pad(value: number): string {
	return String(value).padStart(2, '0');
}

function listNames(names: string[]): string {
	if (names.length <= 1) return names[0] ?? '';
	return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}
