import type { AIInsight } from '@nem/shared';
import { ownText } from './textrank.js';

/**
 * Smart compose (AI-5): a word trigram model with stupid backoff (Brants et al., 2007)
 * trained on the user's sent mail, plus a small seed corpus so a new account still
 * gets suggestions. Counts are plain JSON, so the model saves to IndexedDB as is.
 */
export interface NgramModel {
	version: 1;
	kind: 'ngram';
	/** Context (0 to 2 lowercase previous tokens joined by spaces) → next token → count. */
	counts: Record<string, Record<string, number>>;
}

export type ComposeVerdict = AIInsight<string>;

const START = '<s>';
const ORDER = 3;
/** Stupid backoff discount for each order dropped. */
const BACKOFF = 0.4;
/** A guess must be at least this likely, so ghost text only appears when it is a safe bet. */
const MIN_PROBABILITY = 0.3;
const MAX_WORDS = 5;
/** Sent mail says more about how the user writes than the seed corpus does. */
const USER_WEIGHT = 3;
const TOKEN = /[A-Za-z0-9]+(?:['’][A-Za-z]+)*|[.,!?;:]/g;
const END = /^[.!?]$/;
const PUNCTUATION = /^[.,!?;:]$/;

/** Everyday email phrasing, so suggestions work before the user has sent anything. */
export const COMPOSE_SEED = [
	'Thank you for your email.',
	'Thank you for your help.',
	'Thank you so much for getting back to me.',
	'Thanks for getting back to me.',
	'Thanks for the update.',
	'Thanks for letting me know.',
	'Let me know if you have any questions.',
	'Let me know if you need anything else.',
	'Let me know what you think.',
	'Please let me know if you have any questions.',
	'Please let me know what works for you.',
	'Please find attached the latest version.',
	'Please find attached the report.',
	'I hope you are doing well.',
	'I hope you had a great weekend.',
	'I hope this helps.',
	'I look forward to hearing from you.',
	'Looking forward to hearing from you.',
	'Looking forward to seeing you.',
	'Have a great weekend.',
	'Have a great day.',
	'Talk to you soon.',
	'See you tomorrow.',
	'See you on Monday.',
	'Sounds good to me.',
	'Sounds good, thanks.',
	'I will get back to you as soon as possible.',
	'I will send it over by the end of the day.',
	'I just wanted to follow up on my last email.',
	'I just wanted to check in.',
	'Would you be available for a quick call this week?',
	'Are you free for a quick call tomorrow?',
	'Can we move the meeting to next week?',
	'Sorry for the late reply.',
	'Sorry for the delay.',
	'Happy to help.',
	'Feel free to reach out if you have any questions.',
	'Best regards.',
	'Kind regards.'
];

/** Tokens of one piece of text, with a start marker at each sentence or line start. */
export function composeTokens(text: string): string[] {
	const tokens: string[] = [];
	for (const line of text.split(/\r?\n/)) {
		const words = line.match(TOKEN) ?? [];
		if (words.length === 0) continue;
		tokens.push(START);
		words.forEach((word, i) => {
			tokens.push(word);
			if (END.test(word) && i < words.length - 1) tokens.push(START);
		});
	}
	return tokens;
}

const key = (context: readonly string[]) => context.map((t) => t.toLowerCase()).join(' ');

/** Adds text to the model; quoted replies and the signature are skipped. */
export function learnNgram(model: NgramModel, text: string, weight = USER_WEIGHT): void {
	const tokens = composeTokens(ownText(text));
	tokens.forEach((token, i) => {
		if (token === START) return;
		for (let n = 0; n < ORDER; n++) {
			if (i - n < 0) break;
			const context = key(tokens.slice(i - n, i));
			const next = (model.counts[context] ??= {});
			next[token] = (next[token] ?? 0) + weight;
		}
	});
}

/** A model trained on the seed corpus only. */
export function trainNgramModel(): NgramModel {
	const model: NgramModel = { version: 1, kind: 'ngram', counts: {} };
	for (const sentence of COMPOSE_SEED) learnNgram(model, sentence, 1);
	return model;
}

export function isNgramModel(value: unknown): value is NgramModel {
	return (
		typeof value === 'object' &&
		value !== null &&
		(value as NgramModel).kind === 'ngram' &&
		(value as NgramModel).version === 1 &&
		typeof (value as NgramModel).counts === 'object'
	);
}

interface Guess {
	token: string;
	probability: number;
}

/**
 * The likeliest next token after `context` that starts with `prefix`, backing off from
 * the trigram to the bigram. The unigram is used only to finish a word the user started.
 */
function bestNext(model: NgramModel, context: readonly string[], prefix: string): Guess | null {
	const lower = prefix.toLowerCase();
	const lowest = prefix.length >= 2 ? 0 : 1;
	let discount = 1;
	for (let n = Math.min(ORDER - 1, context.length); n >= lowest; n--) {
		const next = model.counts[key(context.slice(context.length - n))];
		if (next) {
			let total = 0;
			let best: Guess | null = null;
			for (const [token, count] of Object.entries(next)) {
				if (!token.toLowerCase().startsWith(lower) || token.length <= prefix.length) continue;
				total += count;
				if (!best || count > best.probability) best = { token, probability: count };
			}
			if (best) {
				return { token: best.token, probability: (best.probability / total) * discount };
			}
		}
		discount *= BACKOFF;
	}
	return null;
}

/**
 * Ghost text for the text before the caret (one paragraph), or null when no guess is
 * likely enough. Finishes a word the user started, then adds up to five more words,
 * stopping at the end of a sentence.
 */
export function completeText(model: NgramModel, before: string): ComposeVerdict | null {
	const text = before.replace(/\u00a0/g, ' ');
	if (!text.trim()) return null;
	const tokens = composeTokens(text);
	const isMidWord = /[A-Za-z0-9']$/.test(text);
	const prefix = isMidWord ? (tokens.pop() ?? '') : '';
	if (isMidWord && prefix.length < 2) return null;
	const context = [...tokens];
	// After a full stop the next guess starts a sentence, as in training.
	if (!isMidWord && END.test(context.at(-1) ?? '')) context.push(START);
	let suffix = '';
	let confidence = 1;
	let words = 0;
	let partial = prefix;
	while (words < MAX_WORDS) {
		const guess = bestNext(model, context, partial);
		if (!guess || guess.probability < MIN_PROBABILITY) break;
		const piece = partial ? guess.token.slice(partial.length) : guess.token;
		const isFirst = suffix === '' && !isMidWord;
		const gap =
			partial || PUNCTUATION.test(guess.token) || (isFirst && /\s$/.test(text)) ? '' : ' ';
		suffix += gap + piece;
		confidence *= guess.probability;
		context.push(guess.token);
		partial = '';
		words += 1;
		if (END.test(guess.token)) break;
	}
	if (suffix.trim().length < 2) return null;
	return {
		value: suffix,
		confidence: Math.round(confidence * 100) / 100,
		explanation: 'Predicted from phrases you often write in sent mail. Press Tab to accept.',
		source: 'model'
	};
}
