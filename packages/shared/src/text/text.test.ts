import { describe, expect, it } from 'vitest';
import {
	cosineSimilarity,
	countTerms,
	inverseDocumentFrequency,
	ngrams,
	normalize,
	removeStopwords,
	tfidfVector,
	tokenize,
	topTerms
} from './index';

describe('normalize and tokenize', () => {
	it('lowercases, folds accents, straightens quotes and collapses spaces', () => {
		expect(normalize('  Café  RÉSUMÉ\n\t“Naïve” ')).toBe('cafe resume "naive"');
	});

	it('keeps inner apostrophes and digits, drops punctuation and emoji', () => {
		expect(tokenize("Don’t miss the 3pm call!! 🎉 See you at o'clock-ish.")).toEqual([
			"don't",
			'miss',
			'the',
			'3pm',
			'call',
			'see',
			'you',
			'at',
			"o'clock",
			'ish'
		]);
	});

	it('can drop stopwords and short tokens', () => {
		expect(
			tokenize('The invoice is due on Friday, a week from now', { removeStopwords: true })
		).toEqual(['invoice', 'due', 'friday', 'week']);
		expect(tokenize('a bb ccc', { minLength: 2 })).toEqual(['bb', 'ccc']);
		expect(removeStopwords(['you', 'win', 'a', 'prize'])).toEqual(['win', 'prize']);
		expect(tokenize('  !!! ')).toEqual([]);
	});
});

describe('ngrams', () => {
	it('builds runs of n tokens and counts them', () => {
		const tokens = ['see', 'you', 'soon', 'see', 'you'];
		expect(ngrams(tokens, 2)).toEqual(['see you', 'you soon', 'soon see', 'see you']);
		expect(ngrams(tokens, 6)).toEqual([]);
		expect(countTerms(ngrams(tokens, 2)).get('see you')).toBe(2);
		expect(() => ngrams(tokens, 0)).toThrow(RangeError);
	});
});

describe('TF-IDF', () => {
	const docs = [
		'meeting moved to friday',
		'your invoice for the meeting room',
		'claim your free prize now'
	].map((text) => tokenize(text, { removeStopwords: true }));
	const idf = inverseDocumentFrequency(docs);

	it('weights rare terms above common ones (smoothed idf)', () => {
		expect(idf.get('meeting')).toBeCloseTo(Math.log(4 / 3) + 1);
		expect(idf.get('prize')).toBeCloseTo(Math.log(4 / 2) + 1);
		const vector = tfidfVector(docs[0]!, idf, docs.length);
		expect(vector.get('friday')!).toBeGreaterThan(vector.get('meeting')!);
		expect(topTerms(vector, 1)).toEqual(['friday']);
	});

	it('makes unit vectors and compares them by cosine', () => {
		const vectors = docs.map((tokens) => tfidfVector(tokens, idf, docs.length));
		const length = Math.sqrt([...vectors[0]!.values()].reduce((sum, w) => sum + w * w, 0));
		expect(length).toBeCloseTo(1);
		expect(cosineSimilarity(vectors[0]!, vectors[0]!)).toBeCloseTo(1);
		expect(cosineSimilarity(vectors[0]!, vectors[1]!)).toBeGreaterThan(0);
		expect(cosineSimilarity(vectors[0]!, vectors[2]!)).toBe(0);
		expect(cosineSimilarity(new Map(), vectors[0]!)).toBe(0);
	});

	it('gives terms unseen in the corpus the highest weight', () => {
		const vector = tfidfVector(['meeting', 'zebra'], idf, docs.length);
		expect(vector.get('zebra')!).toBeGreaterThan(vector.get('meeting')!);
	});
});
