import {
	cosineSimilarity,
	inverseDocumentFrequency,
	tfidfVector,
	tokenize,
	type AIInsight
} from '@nem/shared';

/** One message as the summarizer reads it. */
export interface SummaryMessage {
	/** The sender's display name or email, for action items. */
	from: string;
	text: string;
}

export interface ThreadSummaryValue {
	text: string;
	actionItems: string[];
}

export type SummaryVerdict = AIInsight<ThreadSummaryValue>;

/** Sentences picked for the summary. */
export const SUMMARY_SENTENCES = 2;
/** Fewer sentences than this and the thread is short enough to read as is. */
export const MIN_SUMMARY_SENTENCES = 3;
const MAX_ACTION_ITEMS = 3;
const DAMPING = 0.85;
const ITERATIONS = 30;

// Lines that are not the writer's own words: quotes, reply headers, signatures.
const QUOTE = /^\s*>/;
const REPLY_HEADER = /^\s*on .+wrote:\s*$/i;
const SIGNATURE = /^\s*(--\s*|sent from my .+)$/i;
// Openers and sign-offs, which say nothing about the thread.
const FILLER =
	/^(hi|hello|hey|dear|thanks|thank you|cheers|best|regards|best regards|kind regards|warmly|sincerely)\b[^.!?]{0,30}[,!.]?$/i;
// A request or a to-do aimed at the reader.
const ACTION =
	/\b(please|can you|could you|would you|need to|needs to|make sure|don't forget|remember to|let me know|action required|by (monday|tuesday|wednesday|thursday|friday|tomorrow|tonight|eod|end of day|the end of))\b/i;

/** The writer's own text: everything above the quoted reply, minus signatures. */
export function ownText(text: string): string {
	const kept: string[] = [];
	for (const line of text.split(/\r?\n/)) {
		if (REPLY_HEADER.test(line) || SIGNATURE.test(line)) break;
		if (!QUOTE.test(line)) kept.push(line);
	}
	return kept.join('\n');
}

/** Splits text into sentences, dropping greetings, sign-offs and fragments. */
export function splitSentences(text: string): string[] {
	return ownText(text)
		.split(/\n+|(?<=[.!?])\s+(?=[A-Z0-9"'(])/)
		.map((sentence) => sentence.replace(/\s+/g, ' ').trim())
		.filter((sentence) => tokenize(sentence).length >= 3 && !FILLER.test(sentence));
}

/**
 * TextRank (Mihalcea & Tarau, 2004): sentences vote for the sentences they resemble
 * (TF-IDF cosine similarity), and PageRank's power iteration turns the votes into
 * centrality scores. The most central sentences carry the thread's main points.
 */
export function textRank(sentences: readonly string[]): number[] {
	const count = sentences.length;
	if (count === 0) return [];
	const tokens = sentences.map((s) => tokenize(s, { removeStopwords: true, minLength: 2 }));
	const idf = inverseDocumentFrequency(tokens);
	const vectors = tokens.map((t) => tfidfVector(t, idf, count));
	const weights = vectors.map((a, i) =>
		vectors.map((b, j) => (i === j ? 0 : cosineSimilarity(a, b)))
	);
	const outgoing = weights.map((row) => row.reduce((sum, w) => sum + w, 0));
	let scores = Array<number>(count).fill(1 / count);
	for (let iteration = 0; iteration < ITERATIONS; iteration++) {
		scores = scores.map((_, i) => {
			let rank = 0;
			for (let j = 0; j < count; j++) {
				const out = outgoing[j] ?? 0;
				if (out > 0) rank += ((weights[j]?.[i] ?? 0) / out) * (scores[j] ?? 0);
			}
			return (1 - DAMPING) / count + DAMPING * rank;
		});
	}
	return scores;
}

/** Requests and to-dos in the thread, newest first, each with who asked. */
export function actionItems(messages: readonly SummaryMessage[]): string[] {
	const items: string[] = [];
	for (const message of [...messages].reverse()) {
		for (const sentence of splitSentences(message.text)) {
			if (!ACTION.test(sentence)) continue;
			const item = `${message.from}: ${sentence.replace(/^(also|and|so),?\s+/i, '')}`;
			if (!items.includes(item)) items.push(item);
			if (items.length === MAX_ACTION_ITEMS) return items;
		}
	}
	return items;
}

/**
 * Extractive summary of a thread: the most central sentences in reading order, plus
 * action items. Null when the thread is too short to need one.
 */
export function summarizeThread(messages: readonly SummaryMessage[]): SummaryVerdict | null {
	const sentences = messages.flatMap((message) => splitSentences(message.text));
	if (sentences.length < MIN_SUMMARY_SENTENCES) return null;
	const scores = textRank(sentences);
	const picked = scores
		.map((score, index) => ({ score, index }))
		.sort((a, b) => b.score - a.score || a.index - b.index)
		.slice(0, SUMMARY_SENTENCES)
		.sort((a, b) => a.index - b.index);
	// How much of the thread's centrality the picked sentences hold, vs. an even spread.
	const share = picked.reduce((sum, { score }) => sum + score, 0);
	const even = SUMMARY_SENTENCES / sentences.length;
	return {
		value: {
			text: picked.map(({ index }) => sentences[index]).join(' '),
			actionItems: actionItems(messages)
		},
		confidence: Math.round(Math.min(0.95, Math.max(0.3, 0.5 + share - even)) * 100) / 100,
		explanation: `TextRank picked the ${SUMMARY_SENTENCES} most central of ${sentences.length} sentences, on this device. Action items are sentences that ask for something.`,
		source: 'model'
	};
}
