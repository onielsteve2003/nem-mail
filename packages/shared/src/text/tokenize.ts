import { normalize } from './normalize';
import { removeStopwords } from './stopwords';

/** A word: letters or digits, with inner apostrophes kept (don't, o'clock). */
const WORD = /[\p{L}\p{N}]+(?:'[\p{L}\p{N}]+)*/gu;

export interface TokenizeOptions {
	/** Drop stopwords (the, and, you…). Off by default: n-gram models need them. */
	removeStopwords?: boolean;
	/** Drop tokens shorter than this. */
	minLength?: number;
}

/** Splits text into normalized word tokens. Punctuation, emoji and symbols are dropped. */
export function tokenize(text: string, options: TokenizeOptions = {}): string[] {
	const { removeStopwords: shouldRemove = false, minLength = 1 } = options;
	let tokens: string[] = normalize(text).match(WORD) ?? [];
	if (minLength > 1) tokens = tokens.filter((token) => token.length >= minLength);
	return shouldRemove ? removeStopwords(tokens) : tokens;
}
