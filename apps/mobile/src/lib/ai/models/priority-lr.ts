import type { AIInsight, Category } from '@nem/shared';

/** What the priority model reads about one message (AI-6). Built on the main thread. */
export interface PriorityInput {
	fromEmail: string;
	subject: string;
	/** The snippet or body text. */
	text: string;
	/** The user is named among the recipients (not only a list or Bcc). */
	isDirect: boolean;
	/** Everyone it went to, the user included. */
	recipientCount: number;
	messageCount: number;
	category: Category | null;
	hasAttachments: boolean;
	/** Messages the user has exchanged with the sender (contact frequency); 0 for strangers. */
	senderFrequency: number;
}

export type PriorityVerdict = AIInsight<number>;

/** Plain JSON, so it can be saved to IndexedDB and sent across the worker boundary. */
export interface LogisticModel {
	version: 1;
	kind: 'logistic';
	weights: number[];
	bias: number;
}

/** A training example: features, label (1 = engaged / important) and an optional weight. */
export interface LogisticSample {
	x: readonly number[];
	y: 0 | 1;
	weight?: number;
}

/** At or above this score a message gets the Important marker. */
export const IMPORTANT_THRESHOLD = 0.6;

const URGENT =
	/\b(urgent|asap|deadline|today|tonight|eod|action required|time[- ]sensitive|overdue|immediately)\b/i;
const REQUEST = /\?|\b(can you|could you|please|let me know|thoughts|review|approve|sign)\b/i;
const BULK_SENDER = /no-?reply|newsletter|notifications?@|marketing|digest@|news@/i;
const BULK_TABS: ReadonlySet<Category> = new Set(['promotions', 'social', 'forums']);
// Frequency at which "how often you mail them" saturates.
const FREQUENCY_CAP = 30;

/**
 * The features, in vector order, with the reason each gives when it pushes the score.
 * The reasons finish "Important because …" / "Not important because …".
 */
export const PRIORITY_FEATURES = [
	{ id: 'knownSender', reason: 'you have written to this sender' },
	{ id: 'senderFrequency', reason: 'you mail with them often' },
	{ id: 'direct', reason: 'it was sent to you directly' },
	{ id: 'smallAudience', reason: 'it went to only a few people' },
	{ id: 'urgent', reason: 'it mentions a deadline or urgency' },
	{ id: 'request', reason: 'it asks you something' },
	{ id: 'conversation', reason: 'it is a conversation with replies' },
	{ id: 'bulk', reason: 'it looks like bulk mail' },
	{ id: 'attachment', reason: 'it has attachments' },
	{ id: 'automated', reason: 'it is an automated update' }
] as const;

/** Turns a message into the model's feature vector (each value from 0 to 1). */
export function priorityFeatures(input: PriorityInput): number[] {
	const text = `${input.subject}\n${input.text}`;
	const isBulk =
		(input.category !== null && BULK_TABS.has(input.category)) ||
		BULK_SENDER.test(input.fromEmail) ||
		/\bunsubscribe\b/i.test(input.text);
	return [
		input.senderFrequency > 0 ? 1 : 0,
		Math.min(1, Math.log1p(input.senderFrequency) / Math.log1p(FREQUENCY_CAP)),
		input.isDirect ? 1 : 0,
		input.recipientCount <= 2 ? 1 : 0,
		URGENT.test(text) ? 1 : 0,
		REQUEST.test(text) ? 1 : 0,
		input.messageCount > 1 ? 1 : 0,
		isBulk ? 1 : 0,
		input.hasAttachments ? 1 : 0,
		input.category === 'updates' ? 1 : 0
	];
}

function sigmoid(z: number): number {
	return 1 / (1 + Math.exp(-z));
}

/** The model's probability that the user engages with a message with features `x`. */
export function predictLogistic(model: LogisticModel, x: readonly number[]): number {
	let z = model.bias;
	for (let i = 0; i < x.length; i++) z += (model.weights[i] ?? 0) * (x[i] ?? 0);
	return sigmoid(z);
}

export interface TrainOptions {
	epochs?: number;
	/** Gradient descent step size. */
	rate?: number;
	/** L2 penalty, which keeps weights small so one feature cannot dominate. */
	l2?: number;
}

/**
 * Fits logistic regression with batch gradient descent on the log loss.
 * Written from scratch: every epoch averages the gradient over all samples.
 */
export function trainLogistic(
	samples: readonly LogisticSample[],
	size: number,
	{ epochs = 300, rate = 0.5, l2 = 0.001 }: TrainOptions = {}
): LogisticModel {
	const model: LogisticModel = {
		version: 1,
		kind: 'logistic',
		weights: Array(size).fill(0),
		bias: 0
	};
	const total = samples.reduce((sum, s) => sum + (s.weight ?? 1), 0) || 1;
	for (let epoch = 0; epoch < epochs; epoch++) {
		const grad = Array<number>(size).fill(0);
		let gradBias = 0;
		for (const { x, y, weight = 1 } of samples) {
			const error = (predictLogistic(model, x) - y) * weight;
			for (let i = 0; i < size; i++) grad[i] = (grad[i] ?? 0) + error * (x[i] ?? 0);
			gradBias += error;
		}
		for (let i = 0; i < size; i++) {
			const w = model.weights[i] ?? 0;
			model.weights[i] = w - rate * ((grad[i] ?? 0) / total + l2 * w);
		}
		model.bias -= (rate * gradBias) / total;
	}
	return model;
}

/** A small deterministic PRNG (mulberry32), so the seed model is the same on every device. */
function random(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/**
 * How a typical user engages, used only to simulate a history: who they open and reply to.
 * Known, frequent, direct senders and requests win; bulk and automated mail lose.
 */
const SIMULATED_WEIGHTS = [1.2, 1.6, 1.1, 0.6, 1.2, 0.9, 0.8, -2.4, 0.3, -0.9];
const SIMULATED_BIAS = -1.6;

/**
 * Simulated engagement (there is no real history on a fresh device): random messages
 * whose features co-occur like real mail, labelled engaged or not by the typical user above.
 */
export function simulateEngagement(count = 600, seed = 7): LogisticSample[] {
	const next = random(seed);
	const flip = (p: number) => (next() < p ? 1 : 0);
	const samples: LogisticSample[] = [];
	for (let n = 0; n < count; n++) {
		const bulk = flip(0.45);
		const known = bulk ? flip(0.05) : flip(0.55);
		const x = [
			known,
			known ? next() : 0,
			bulk ? flip(0.2) : flip(0.8),
			bulk ? flip(0.1) : flip(0.6),
			flip(bulk ? 0.15 : 0.2),
			flip(bulk ? 0.2 : 0.45),
			bulk ? 0 : flip(0.35),
			bulk,
			flip(0.15),
			bulk ? flip(0.2) : flip(0.15)
		];
		let z = SIMULATED_BIAS;
		for (let i = 0; i < x.length; i++) z += (SIMULATED_WEIGHTS[i] ?? 0) * (x[i] ?? 0);
		samples.push({ x, y: next() < sigmoid(z) ? 1 : 0 });
	}
	return samples;
}

/** The starting model: trained on simulated engagement. Instant (a few ms). */
export function trainPriorityModel(): LogisticModel {
	return trainLogistic(simulateEngagement(), PRIORITY_FEATURES.length);
}

/** True for a saved priority model (anything else is retrained). */
export function isLogisticModel(value: unknown): value is LogisticModel {
	return (
		typeof value === 'object' &&
		value !== null &&
		(value as LogisticModel).kind === 'logistic' &&
		Array.isArray((value as LogisticModel).weights) &&
		(value as LogisticModel).weights.length === PRIORITY_FEATURES.length
	);
}

function joinReasons(reasons: string[]): string {
	return reasons.length > 1
		? `${reasons.slice(0, -1).join(', ')} and ${reasons.at(-1)}`
		: (reasons[0] ?? '');
}

/** Scores a message from 0 (ignore) to 1 (important), with the features that moved it most. */
export function scorePriority(model: LogisticModel, input: PriorityInput): PriorityVerdict {
	const x = priorityFeatures(input);
	const score = predictLogistic(model, x);
	const isImportant = score >= IMPORTANT_THRESHOLD;
	// Each active feature's pull on the score, strongest in the verdict's direction first.
	const pulls = x
		.map((value, i) => ({ i, pull: value * (model.weights[i] ?? 0) }))
		.filter(({ pull }) => (isImportant ? pull > 0.05 : pull < -0.05))
		.sort((a, b) => (isImportant ? b.pull - a.pull : a.pull - b.pull))
		.slice(0, 2)
		.map(({ i }) => PRIORITY_FEATURES[i]?.reason ?? '');
	const explanation = isImportant
		? `Important because ${joinReasons(pulls)}.`
		: pulls.length > 0
			? `Not marked important because ${joinReasons(pulls)}.`
			: 'Not marked important: nothing in it stood out, like a familiar sender or a request.';
	return {
		value: Math.round(score * 100) / 100,
		confidence: Math.round(Math.max(score, 1 - score) * 100) / 100,
		explanation,
		source: 'model'
	};
}

/** How strongly each signal teaches: an explicit mark counts far more than an open. */
export const FEEDBACK_STEPS = { mark: 40, open: 1 } as const;
export type PrioritySignal = keyof typeof FEEDBACK_STEPS;
const FEEDBACK_RATE = 0.3;
const FEEDBACK_MARGIN = 0.1;

/**
 * Learns from the user with stochastic gradient steps on one message. A mark keeps
 * stepping until the message lands on the user's side of the threshold (or steps run out).
 */
export function learnPriorityFeedback(
	model: LogisticModel,
	input: PriorityInput,
	isImportant: boolean,
	signal: PrioritySignal
): void {
	const x = priorityFeatures(input);
	const y = isImportant ? 1 : 0;
	for (let step = 0; step < FEEDBACK_STEPS[signal]; step++) {
		const score = predictLogistic(model, x);
		// A margin past the threshold, so the next similar message lands the same way.
		const isSettled = isImportant
			? score >= IMPORTANT_THRESHOLD + FEEDBACK_MARGIN
			: score < IMPORTANT_THRESHOLD - FEEDBACK_MARGIN;
		if (signal === 'mark' && isSettled) break;
		const error = score - y;
		for (let i = 0; i < x.length; i++) {
			model.weights[i] = (model.weights[i] ?? 0) - FEEDBACK_RATE * error * (x[i] ?? 0);
		}
		model.bias -= FEEDBACK_RATE * error;
	}
}
