/** Curly quotes and apostrophes as typed on phones, mapped to the plain ones. */
const QUOTES: Record<string, string> = { '‘': "'", '’': "'", '“': '"', '”': '"' };

/**
 * Lowercases, folds accents (café → cafe), straightens curly quotes and collapses
 * whitespace, so the same word always looks the same to a model.
 */
export function normalize(text: string): string {
	return text
		.normalize('NFKD')
		.replace(/\p{M}/gu, '')
		.replace(/[‘’“”]/g, (quote) => QUOTES[quote] ?? quote)
		.toLowerCase()
		.replace(/\s+/g, ' ')
		.trim();
}
