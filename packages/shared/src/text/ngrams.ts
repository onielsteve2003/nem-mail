/**
 * Every run of `n` consecutive tokens, joined by a space:
 * `ngrams(['see', 'you', 'soon'], 2)` → `['see you', 'you soon']`.
 * @throws RangeError when `n` is not a positive integer.
 */
export function ngrams(tokens: readonly string[], n: number): string[] {
	if (!Number.isInteger(n) || n < 1) throw new RangeError(`n must be a positive integer, got ${n}`);
	const grams: string[] = [];
	for (let start = 0; start + n <= tokens.length; start += 1) {
		grams.push(tokens.slice(start, start + n).join(' '));
	}
	return grams;
}

/** How often each item occurs. */
export function countTerms(terms: readonly string[]): Map<string, number> {
	const counts = new Map<string, number>();
	for (const term of terms) counts.set(term, (counts.get(term) ?? 0) + 1);
	return counts;
}
