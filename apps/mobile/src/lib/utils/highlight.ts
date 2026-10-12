/** A run of text, marked when it matches a search term. */
export interface HighlightPart {
	text: string;
	match: boolean;
}

/** Splits `text` into runs, marking every case-insensitive occurrence of a term (FR-7.6). */
export function highlightParts(text: string, terms: readonly string[]): HighlightPart[] {
	const lower = text.toLowerCase();
	const needles = terms.map((t) => t.trim().toLowerCase()).filter(Boolean);
	if (!text || needles.length === 0) return [{ text, match: false }];

	// Mark covered characters first, so overlapping terms merge into one run.
	const covered = new Array<boolean>(text.length).fill(false);
	for (const needle of needles) {
		for (let at = lower.indexOf(needle); at !== -1; at = lower.indexOf(needle, at + 1)) {
			covered.fill(true, at, at + needle.length);
		}
	}

	const parts: HighlightPart[] = [];
	for (let i = 0; i < text.length;) {
		const match = covered[i] ?? false;
		let end = i + 1;
		while (end < text.length && (covered[end] ?? false) === match) end++;
		parts.push({ text: text.slice(i, end), match });
		i = end;
	}
	return parts;
}
