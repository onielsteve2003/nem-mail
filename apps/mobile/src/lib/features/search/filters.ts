import { formatQuery, parseQuery, type SearchClause } from '@nem/shared';

/** Filter chips under the search bar (FR-7.3). Each one owns one or more operators. */
export type FilterKind = 'from' | 'to' | 'date' | 'attachment' | 'unread' | 'label';

/** Date presets for the Date chip, written as before:/after: relative to today. */
export const DATE_PRESETS = [
	{ id: 'week', label: 'Last 7 days', kind: 'after', days: 7 },
	{ id: 'month', label: 'Last 30 days', kind: 'after', days: 30 },
	{ id: 'older-week', label: 'Older than a week', kind: 'before', days: 7 },
	{ id: 'older-month', label: 'Older than a month', kind: 'before', days: 30 },
	{ id: 'older-year', label: 'Older than a year', kind: 'before', days: 365 }
] as const;
export type DatePreset = (typeof DATE_PRESETS)[number];

function owns(kind: FilterKind, clause: SearchClause): boolean {
	if (clause.negated) return false;
	switch (kind) {
		case 'from':
		case 'to':
		case 'label':
			return clause.kind === kind;
		case 'date':
			return clause.kind === 'before' || clause.kind === 'after';
		case 'attachment':
			return clause.kind === 'has';
		case 'unread':
			return clause.kind === 'is' && clause.value === 'unread';
	}
}

/** The operators the chip currently holds in `query`; empty when the chip is off. */
export function filterClauses(query: string, kind: FilterKind): SearchClause[] {
	return parseQuery(query).clauses.filter((c) => owns(kind, c));
}

/** Replaces whatever the chip held with `clauses` (none turns it off); other words stay put. */
export function setFilter(query: string, kind: FilterKind, clauses: SearchClause[]): string {
	const kept = parseQuery(query).clauses.filter((c) => !owns(kind, c));
	return formatQuery({ clauses: [...kept, ...clauses] });
}

/** The single clause a toggle chip adds. */
export function toggleClause(kind: 'attachment' | 'unread'): SearchClause {
	return kind === 'attachment'
		? { kind: 'has', value: 'attachment', negated: false }
		: { kind: 'is', value: 'unread', negated: false };
}

/** Local calendar date `days` before `now`, as YYYY-MM-DD. */
export function daysAgo(days: number, now = new Date()): string {
	const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days);
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** The before:/after: clause a date preset writes. */
export function presetClause(preset: DatePreset, now = new Date()): SearchClause {
	return { kind: preset.kind, value: daysAgo(preset.days, now), negated: false };
}

/** The preset matching the query's date clause, so the sheet can show it as chosen. */
export function activePreset(query: string, now = new Date()): DatePreset | undefined {
	const [clause, extra] = filterClauses(query, 'date');
	if (!clause || extra) return undefined;
	return DATE_PRESETS.find((p) => p.kind === clause.kind && daysAgo(p.days, now) === clause.value);
}
