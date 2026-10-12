import { countTerms } from './ngrams';

/** A sparse vector: term → weight. */
export type TermVector = Map<string, number>;

/**
 * Inverse document frequency of every term across the documents (token lists), smoothed
 * like scikit-learn: `ln((1 + N) / (1 + df)) + 1`, so a term in every document still counts a little.
 */
export function inverseDocumentFrequency(documents: readonly (readonly string[])[]): TermVector {
	const documentFrequency = new Map<string, number>();
	for (const tokens of documents) {
		for (const term of new Set(tokens)) {
			documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
		}
	}
	const total = documents.length;
	const idf: TermVector = new Map();
	for (const [term, df] of documentFrequency) idf.set(term, Math.log((1 + total) / (1 + df)) + 1);
	return idf;
}

/**
 * TF-IDF vector of one document, L2-normalized so long and short documents compare fairly.
 * Terms missing from `idf` (unseen in the corpus) get the weight of a term in no document.
 */
export function tfidfVector(
	tokens: readonly string[],
	idf: TermVector,
	corpusSize = 0
): TermVector {
	const unseen = Math.log(1 + corpusSize) + 1;
	const vector: TermVector = new Map();
	for (const [term, count] of countTerms(tokens)) {
		vector.set(term, count * (idf.get(term) ?? unseen));
	}
	const length = norm(vector);
	if (length > 0) for (const [term, weight] of vector) vector.set(term, weight / length);
	return vector;
}

/** Cosine similarity of two sparse vectors, from 0 (nothing shared) to 1 (same direction). */
export function cosineSimilarity(a: TermVector, b: TermVector): number {
	const [small, large] = a.size <= b.size ? [a, b] : [b, a];
	let dot = 0;
	for (const [term, weight] of small) dot += weight * (large.get(term) ?? 0);
	const norms = norm(a) * norm(b);
	return norms === 0 ? 0 : dot / norms;
}

/** The `limit` highest-weighted terms, best first; ties keep alphabetical order. */
export function topTerms(vector: TermVector, limit: number): string[] {
	return [...vector]
		.sort(([termA, a], [termB, b]) => b - a || termA.localeCompare(termB))
		.slice(0, limit)
		.map(([term]) => term);
}

/** Euclidean length; a loop, since spreading a large vector into Math.hypot overflows the stack. */
function norm(vector: TermVector): number {
	let sum = 0;
	for (const weight of vector.values()) sum += weight * weight;
	return Math.sqrt(sum);
}
