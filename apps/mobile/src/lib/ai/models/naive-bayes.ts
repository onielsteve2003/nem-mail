/**
 * Multinomial Naive Bayes, written from scratch (PRD AI-2, reused by AI-1).
 * Counts only, so training is instant and the whole model is a plain JSON object
 * that can be saved in IndexedDB and updated one message at a time.
 */

/** Laplace smoothing: an unseen word gets a count of 1 instead of 0. */
const ALPHA = 1;

/** The saved model: per-class document and token counts. */
export interface NaiveBayesState<C extends string = string> {
	version: 1;
	classes: C[];
	/** Documents learned per class. */
	docs: Record<C, number>;
	/** Total tokens learned per class. */
	totals: Record<C, number>;
	/** token → count per class. */
	counts: Record<string, Partial<Record<C, number>>>;
}

/** A prediction: the winning class and the probability of every class. */
export interface NaiveBayesPrediction<C extends string = string> {
	label: C;
	probabilities: Record<C, number>;
}

/** A word that pushed the prediction toward a class, with its log-likelihood ratio. */
export interface TokenEvidence {
	token: string;
	weight: number;
}

/** Creates an empty model for the given classes. */
export function createNaiveBayes<C extends string>(classes: readonly C[]): NaiveBayesState<C> {
	const zero = () => Object.fromEntries(classes.map((c) => [c, 0])) as Record<C, number>;
	return { version: 1, classes: [...classes], docs: zero(), totals: zero(), counts: {} };
}

/** Learns one document. `weight` > 1 makes user feedback count more than seed data. */
export function learnNaiveBayes<C extends string>(
	model: NaiveBayesState<C>,
	tokens: readonly string[],
	label: C,
	weight = 1
): void {
	model.docs[label] += weight;
	for (const token of tokens) {
		const row = (model.counts[token] ??= {});
		row[label] = (row[label] ?? 0) + weight;
		model.totals[label] += weight;
	}
}

/** Removes one previously learned document, e.g. when the user says "Not spam". */
export function unlearnNaiveBayes<C extends string>(
	model: NaiveBayesState<C>,
	tokens: readonly string[],
	label: C,
	weight = 1
): void {
	model.docs[label] = Math.max(0, model.docs[label] - weight);
	for (const token of tokens) {
		const row = model.counts[token];
		if (!row?.[label]) continue;
		const removed = Math.min(row[label], weight);
		row[label] -= removed;
		model.totals[label] -= removed;
	}
}

function vocabularySize(model: NaiveBayesState): number {
	return Math.max(1, Object.keys(model.counts).length);
}

/** log P(token | class) with Laplace smoothing. */
function logLikelihood<C extends string>(model: NaiveBayesState<C>, token: string, label: C) {
	const count = model.counts[token]?.[label] ?? 0;
	return Math.log((count + ALPHA) / (model.totals[label] + ALPHA * vocabularySize(model)));
}

/** Scores the tokens against every class. Unknown words are ignored. */
export function predictNaiveBayes<C extends string>(
	model: NaiveBayesState<C>,
	tokens: readonly string[]
): NaiveBayesPrediction<C> {
	const totalDocs = model.classes.reduce((sum, c) => sum + model.docs[c], 0);
	const known = tokens.filter((token) => token in model.counts);
	const scores = model.classes.map((label) => {
		const prior = Math.log(
			(model.docs[label] + ALPHA) / (totalDocs + ALPHA * model.classes.length)
		);
		return known.reduce((sum, token) => sum + logLikelihood(model, token, label), prior);
	});
	// Softmax over log scores, shifted by the max so exp() cannot overflow.
	const max = Math.max(...scores);
	const exps = scores.map((score) => Math.exp(score - max));
	const sum = exps.reduce((a, b) => a + b, 0);
	const probabilities = Object.fromEntries(
		model.classes.map((label, i) => [label, (exps[i] ?? 0) / sum])
	) as Record<C, number>;
	const best = scores.indexOf(max);
	return { label: model.classes[best] as C, probabilities };
}

/**
 * The words in `tokens` that most favor `label` over the other classes, strongest first.
 * Used for the "why flagged" explanation.
 */
export function explainNaiveBayes<C extends string>(
	model: NaiveBayesState<C>,
	tokens: readonly string[],
	label: C,
	limit = 3
): TokenEvidence[] {
	const others = model.classes.filter((c) => c !== label);
	const seen = new Set<string>();
	const evidence: TokenEvidence[] = [];
	for (const token of tokens) {
		if (seen.has(token) || !(token in model.counts)) continue;
		seen.add(token);
		const own = logLikelihood(model, token, label);
		const rival = Math.max(...others.map((other) => logLikelihood(model, token, other)));
		const weight = own - rival;
		if (weight > 0) evidence.push({ token, weight });
	}
	return evidence.sort((a, b) => b.weight - a.weight).slice(0, limit);
}
