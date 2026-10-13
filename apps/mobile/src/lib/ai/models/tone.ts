import type { AIInsight } from '@nem/shared';
import { normalize } from '@nem/shared';

/** What the tone check found in a message the user is about to send (AI-8). */
export interface Tone {
	/** True when the message may read as harsh or hostile. */
	isHarsh: boolean;
	/** -1 (hostile) to 1 (warm). */
	score: number;
	/** The words and habits that made it read that way, as written. */
	reasons: string[];
}

export type ToneVerdict = AIInsight<Tone>;

/** A sentiment model's answer for the whole text, when one is downloaded. */
export interface Sentiment {
	label: 'POSITIVE' | 'NEGATIVE';
	score: number;
}

/**
 * Hand-written lexicon in the AFINN style (-5 to 5), limited to words that change how
 * an email lands. Harsh words weigh most, since the check exists to catch them.
 */
const LEXICON: Record<string, number> = {
	// Hostile or insulting.
	stupid: -5,
	idiot: -5,
	idiotic: -5,
	moron: -5,
	pathetic: -5,
	incompetent: -5,
	useless: -4,
	ridiculous: -4,
	unacceptable: -4,
	disgraceful: -4,
	terrible: -4,
	awful: -4,
	horrible: -4,
	hate: -4,
	worst: -4,
	garbage: -4,
	nonsense: -3,
	lazy: -3,
	sloppy: -3,
	careless: -3,
	furious: -4,
	outrageous: -4,
	absurd: -3,
	shameful: -3,
	disappointed: -2,
	disappointing: -2,
	annoyed: -2,
	annoying: -2,
	angry: -3,
	obviously: -2,
	clearly: -1,
	seriously: -2,
	whatever: -2,
	failed: -2,
	failure: -2,
	fault: -2,
	blame: -2,
	wrong: -2,
	mess: -2,
	waste: -3,
	wasted: -3,
	never: -1,
	bad: -2,
	poor: -2,
	// Warm.
	thanks: 2,
	thank: 2,
	appreciate: 3,
	appreciated: 3,
	grateful: 3,
	great: 2,
	glad: 2,
	happy: 2,
	please: 1,
	sorry: 1,
	love: 3,
	wonderful: 3,
	excellent: 3,
	helpful: 2,
	kind: 2,
	welcome: 2
};

/** Phrases that sound curt or passive-aggressive even without a harsh word. */
const PHRASES: { pattern: RegExp; weight: number }[] = [
	{ pattern: /\bwhat were you thinking\b/, weight: -5 },
	{ pattern: /\bhow many times\b/, weight: -4 },
	{ pattern: /\bas i (already )?(said|told you|mentioned)\b/, weight: -3 },
	{ pattern: /\bper my last email\b/, weight: -3 },
	{ pattern: /\bi don'?t care\b/, weight: -4 },
	{ pattern: /\b(do|did) you even\b/, weight: -3 },
	{ pattern: /\bfix (this|it) now\b/, weight: -3 },
	{ pattern: /\bthis is a joke\b/, weight: -4 },
	{ pattern: /\bfed up\b/, weight: -3 }
];

const NEGATIONS = new Set(['not', 'no', 'never', "don't", "isn't", "wasn't", "didn't", "can't"]);
const INTENSIFIERS = new Set(['very', 'really', 'so', 'totally', 'completely', 'absolutely']);
/** At or below this score the lexicon alone calls the message harsh. */
const HARSH_SCORE = -0.35;
/** The model alone is too eager (SST-2 calls "I can't make Friday" negative); it needs a sign. */
const MODEL_NEGATIVE = 0.97;
const MIN_SHOUT_LENGTH = 4;

/** Scores tone with the lexicon, phrases, negation, intensifiers, shouting and !!!. */
export function lexiconTone(text: string): Tone {
	const reasons: string[] = [];
	let total = 0;
	let hits = 0;
	const words = text.match(/[A-Za-z]+(?:'[A-Za-z]+)?/g) ?? [];
	words.forEach((word, i) => {
		const lower = word.toLowerCase();
		let weight = LEXICON[lower] ?? 0;
		if (weight === 0) return;
		const prev = words[i - 1]?.toLowerCase() ?? '';
		const prev2 = words[i - 2]?.toLowerCase() ?? '';
		// "not bad" is mild praise, "not helpful" is a complaint.
		if (NEGATIONS.has(prev) || NEGATIONS.has(prev2)) weight = -weight / 2;
		if (INTENSIFIERS.has(prev)) weight *= 1.5;
		total += weight;
		hits += 1;
		if (weight <= -3) reasons.push(word);
	});
	const plain = normalize(text);
	for (const { pattern, weight } of PHRASES) {
		const match = plain.match(pattern);
		if (!match) continue;
		total += weight;
		hits += 1;
		reasons.push(`“${match[0]}”`);
	}
	const shouted = words.filter((w) => w.length >= MIN_SHOUT_LENGTH && w === w.toUpperCase());
	if (shouted.length > 0) {
		total -= 2 * Math.min(shouted.length, 3);
		hits += 1;
		reasons.push('words in all caps');
	}
	if (/[!?]{3,}/.test(text)) {
		total -= 2;
		hits += 1;
		reasons.push('repeated !!! or ???');
	}
	// Squashed into -1..1; more evidence moves it further.
	const score = hits === 0 ? 0 : Math.max(-1, Math.min(1, total / (5 + hits * 2)));
	return { isHarsh: score <= HARSH_SCORE, score: round(score), reasons: [...new Set(reasons)] };
}

/**
 * The tone check before sending. The lexicon decides on its own; a downloaded
 * DistilBERT SST-2 also flags a message it is very sure is negative, but only when the
 * lexicon saw at least a hint of it, so plain bad news is not called harsh.
 */
export function checkTone(text: string, sentiment?: Sentiment | null): ToneVerdict | null {
	if (!text.trim()) return null;
	const tone = lexiconTone(text);
	const modelSaysHarsh =
		sentiment?.label === 'NEGATIVE' && sentiment.score >= MODEL_NEGATIVE && tone.score < 0;
	const isHarsh = tone.isHarsh || modelSaysHarsh;
	const signs = tone.reasons.length ? `: ${tone.reasons.slice(0, 4).join(', ')}` : '';
	if (sentiment) {
		const negative = sentiment.label === 'NEGATIVE' ? sentiment.score : 1 - sentiment.score;
		return {
			value: { ...tone, isHarsh },
			confidence: round(isHarsh ? Math.max(negative, 0.5) : 1 - negative),
			explanation: isHarsh
				? `DistilBERT on this device reads it as negative (${Math.round(negative * 100)}%)${signs}.`
				: 'DistilBERT on this device reads the tone as fine.',
			source: 'model'
		};
	}
	return {
		value: { ...tone, isHarsh },
		confidence: round(Math.min(1, Math.abs(tone.score) + 0.4)),
		explanation: isHarsh
			? `Word list check, no model${signs}.`
			: 'Word list check, no model: nothing sounds harsh.',
		source: 'heuristic'
	};
}

const round = (value: number) => Math.round(value * 100) / 100;
