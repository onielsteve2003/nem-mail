/** Field operators that take free text (FR-7.2). */
export const FIELD_OPERATORS = ['from', 'to', 'subject', 'label'] as const;
export type FieldOperator = (typeof FIELD_OPERATORS)[number];

export const IS_VALUES = ['unread', 'read', 'starred'] as const;
export type IsValue = (typeof IS_VALUES)[number];

export const DATE_OPERATORS = ['before', 'after'] as const;
export type DateOperator = (typeof DATE_OPERATORS)[number];

/** One piece of a search query. `negated` comes from a leading `-`. */
export type SearchClause =
	| { kind: 'text'; value: string; phrase: boolean; negated: boolean }
	| { kind: FieldOperator; value: string; negated: boolean }
	| { kind: 'has'; value: 'attachment'; negated: boolean }
	| { kind: 'is'; value: IsValue; negated: boolean }
	/** `value` is a calendar date, YYYY-MM-DD. */
	| { kind: DateOperator; value: string; negated: boolean };

export interface ParsedQuery {
	clauses: SearchClause[];
}

interface RawToken {
	negated: boolean;
	key: string | null;
	value: string;
	quoted: boolean;
}

const DATE_RE = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/;

/** Splits on whitespace, keeping "quoted phrases" (also after `key:`) together. */
function tokenize(input: string): RawToken[] {
	const tokens: RawToken[] = [];
	let i = 0;
	while (i < input.length) {
		while (i < input.length && /\s/.test(input[i] ?? '')) i++;
		if (i >= input.length) break;

		let negated = false;
		if (input[i] === '-' && i + 1 < input.length && !/\s/.test(input[i + 1] ?? '')) {
			negated = true;
			i++;
		}

		let key: string | null = null;
		const keyMatch = /^([a-z]+):(?=\S)/i.exec(input.slice(i));
		if (keyMatch?.[1]) {
			key = keyMatch[1].toLowerCase();
			i += keyMatch[0].length;
		}

		let value: string;
		let quoted = false;
		if (input[i] === '"') {
			const end = input.indexOf('"', i + 1);
			const stop = end === -1 ? input.length : end;
			value = input.slice(i + 1, stop);
			quoted = true;
			i = stop + 1;
		} else {
			const start = i;
			while (i < input.length && !/\s/.test(input[i] ?? '')) i++;
			value = input.slice(start, i);
		}

		value = value.trim().replace(/\s+/g, ' ');
		if (value !== '') tokens.push({ negated, key, value, quoted });
	}
	return tokens;
}

/** Normalizes 2026/3/7 or 2026-03-07 to 2026-03-07; null when it is not a real date. */
export function parseQueryDate(value: string): string | null {
	const match = DATE_RE.exec(value);
	if (!match) return null;
	const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
	const date = new Date(Date.UTC(y, m - 1, d));
	if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
		return null;
	}
	return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function toClause(token: RawToken): SearchClause {
	const { negated, key, quoted } = token;
	const value = token.value;
	const lower = value.toLowerCase();
	const asText = (): SearchClause => ({
		kind: 'text',
		value: key && !quoted ? `${key}:${lower}` : lower,
		phrase: quoted || lower.includes(' '),
		negated
	});

	if (key === null) return asText();
	if ((FIELD_OPERATORS as readonly string[]).includes(key)) {
		return { kind: key as FieldOperator, value: lower, negated };
	}
	if (key === 'has' && lower === 'attachment') return { kind: 'has', value: 'attachment', negated };
	if (key === 'is' && (IS_VALUES as readonly string[]).includes(lower)) {
		return { kind: 'is', value: lower as IsValue, negated };
	}
	if ((DATE_OPERATORS as readonly string[]).includes(key)) {
		const date = parseQueryDate(value);
		if (date) return { kind: key as DateOperator, value: date, negated };
	}
	// Unknown operators and bad values search as plain text, like Gmail does.
	return asText();
}

/** Parses a Gmail-style query: words, "quoted phrases", -negation and FR-7.2 operators. */
export function parseQuery(input: string): ParsedQuery {
	return { clauses: tokenize(input).map(toClause) };
}

function quoteIfNeeded(value: string): string {
	return /\s/.test(value) ? `"${value}"` : value;
}

/** Writes clauses back to query text; parseQuery(formatQuery(q)) gives the same clauses. */
export function formatQuery(query: ParsedQuery): string {
	return query.clauses
		.map((clause) => {
			const sign = clause.negated ? '-' : '';
			if (clause.kind === 'text') {
				return sign + (clause.phrase ? `"${clause.value}"` : clause.value);
			}
			return `${sign}${clause.kind}:${quoteIfNeeded(clause.value)}`;
		})
		.join(' ');
}

/** The words and phrases to match and highlight (not negated, operators excluded). */
export function queryTerms(query: ParsedQuery): string[] {
	return query.clauses.flatMap((c) =>
		c.kind === 'text' && !c.negated
			? [c.value]
			: c.kind === 'subject' && !c.negated
				? [c.value]
				: []
	);
}
