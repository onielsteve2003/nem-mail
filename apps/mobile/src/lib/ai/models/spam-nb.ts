import { tokenize, type AIInsight } from '@nem/shared';
import {
	createNaiveBayes,
	explainNaiveBayes,
	learnNaiveBayes,
	predictNaiveBayes,
	unlearnNaiveBayes,
	type NaiveBayesState
} from './naive-bayes';
import { checkPhishing, isPhishing, type PhishingInput } from './phishing';
import { SPAM_CORPUS, type SpamSample } from './spam-corpus';

export type SpamClass = 'ham' | 'spam';
export type SpamModel = NaiveBayesState<SpamClass>;
export type SpamVerdict = AIInsight<{ isSpam: boolean; isPhishing: boolean }>;

/** At or above this spam probability a message is flagged. */
export const SPAM_THRESHOLD = 0.5;
/** A user's report counts as this many seed samples, so the model adapts quickly. */
export const FEEDBACK_WEIGHT = 3;

/** Shape markers added as tokens, so the model can learn from them like words. */
function shapeTokens(text: string): string[] {
	const extra: string[] = [];
	if (/[$€£]\s?\d|\d+\s?(?:dollars|usd)\b/i.test(text)) extra.push('__money');
	if (/\b[A-Z]{4,}\b/.test(text)) extra.push('__shout');
	if (/!{1,}/.test(text)) extra.push('__bang');
	if (/https?:\/\//i.test(text)) extra.push('__link');
	return extra;
}

/** The features the spam model sees: content words (2+ letters) plus shape markers. */
export function spamFeatures(text: string): string[] {
	return [...tokenize(text, { removeStopwords: true, minLength: 2 }), ...shapeTokens(text)];
}

/** Trains a fresh model on the given samples (the seed corpus by default). Instant. */
export function trainSpamModel(samples: readonly SpamSample[] = SPAM_CORPUS): SpamModel {
	const model = createNaiveBayes<SpamClass>(['ham', 'spam']);
	for (const sample of samples) {
		learnNaiveBayes(model, spamFeatures(sample.text), sample.isSpam ? 'spam' : 'ham');
	}
	return model;
}

/**
 * Learns from a user's report ("Report spam" or "Not spam"). When it corrects an earlier
 * verdict, the old lesson is removed first so the two do not cancel out.
 */
export function learnSpamFeedback(model: SpamModel, text: string, isSpam: boolean): void {
	const features = spamFeatures(text);
	const label: SpamClass = isSpam ? 'spam' : 'ham';
	unlearnNaiveBayes(model, features, isSpam ? 'ham' : 'spam', FEEDBACK_WEIGHT);
	learnNaiveBayes(model, features, label, FEEDBACK_WEIGHT);
}

/** The spam probability alone, for evaluation. */
export function spamProbability(model: SpamModel, text: string): number {
	return predictNaiveBayes(model, spamFeatures(text)).probabilities.spam;
}

function readable(token: string): string | null {
	return token.startsWith('__') ? null : `“${token}”`;
}

/** Classifies one message and explains the verdict in plain words. */
export function classifySpam(model: SpamModel, message: PhishingInput): SpamVerdict {
	const text = `${message.subject}\n${message.bodyText}`;
	const features = spamFeatures(text);
	const probability = predictNaiveBayes(model, features).probabilities.spam;
	const findings = checkPhishing(message);
	const phishing = isPhishing(findings);
	const isSpam = phishing || probability >= SPAM_THRESHOLD;

	const reasons: string[] = [];
	if (phishing) reasons.push(...findings.map((f) => f.reason));
	const words = explainNaiveBayes(model, features, isSpam ? 'spam' : 'ham')
		.map((e) => readable(e.token))
		.filter((w): w is string => w !== null);
	if (isSpam && words.length > 0) {
		reasons.push(`It uses words common in spam: ${words.join(', ')}.`);
	} else if (!isSpam) {
		reasons.push(
			words.length > 0
				? `It reads like normal mail (${words.join(', ')}).`
				: 'Nothing in it looks like spam.'
		);
	}

	// Phishing rules are certain enough to report high confidence; otherwise trust the model.
	const confidence = phishing ? Math.max(0.9, probability) : isSpam ? probability : 1 - probability;
	return {
		value: { isSpam, isPhishing: phishing },
		confidence: Math.round(confidence * 100) / 100,
		explanation: reasons.join(' '),
		source: phishing && probability < SPAM_THRESHOLD ? 'heuristic' : 'model'
	};
}

export interface SpamEvaluation {
	accuracy: number;
	precision: number;
	recall: number;
	total: number;
}

/** Accuracy, precision and recall of the model on labelled samples (text only, no phishing rules). */
export function evaluateSpam(model: SpamModel, samples: readonly SpamSample[]): SpamEvaluation {
	let tp = 0;
	let fp = 0;
	let fn = 0;
	let correct = 0;
	for (const sample of samples) {
		const predicted = spamProbability(model, sample.text) >= SPAM_THRESHOLD;
		if (predicted === sample.isSpam) correct += 1;
		if (predicted && sample.isSpam) tp += 1;
		if (predicted && !sample.isSpam) fp += 1;
		if (!predicted && sample.isSpam) fn += 1;
	}
	return {
		accuracy: correct / samples.length,
		precision: tp + fp === 0 ? 1 : tp / (tp + fp),
		recall: tp + fn === 0 ? 1 : tp / (tp + fn),
		total: samples.length
	};
}
