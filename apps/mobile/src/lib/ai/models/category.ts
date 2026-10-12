import { CATEGORIES, tokenize, type AIInsight, type Category } from '@nem/shared';
import { CATEGORY_CORPUS, type CategorySample } from './category-corpus';
import {
	createNaiveBayes,
	explainNaiveBayes,
	learnNaiveBayes,
	predictNaiveBayes,
	type NaiveBayesState
} from './naive-bayes';

export type CategoryModel = NaiveBayesState<Category>;
export type CategoryVerdict = AIInsight<Category>;

/** What the category model reads from a message. */
export interface CategoryInput {
	fromEmail: string;
	subject: string;
	bodyText: string;
}

/** A user's "Move to tab" counts as this many seed samples. */
export const CATEGORY_FEEDBACK_WEIGHT = 3;
/** Below this, the optional zero-shot model may give a better answer (AI-1 upgrade). */
export const LOW_CONFIDENCE = 0.6;

const TAB_NAMES: Record<Category, string> = {
	primary: 'Primary',
	promotions: 'Promotions',
	social: 'Social',
	updates: 'Updates',
	forums: 'Forums'
};

interface Rule {
	category: Exclude<Category, 'primary'>;
	reason: string;
	test: (input: CategoryInput, local: string) => boolean;
}

/** High-precision rules, checked in order. Primary has none: it is "a person wrote to you". */
const RULES: readonly Rule[] = [
	{
		category: 'forums',
		reason: 'It comes from a mailing list or discussion group.',
		test: (input, local) =>
			/^\s*\[[\w.-]+\]/.test(input.subject) ||
			/^(list|forum|digest|discuss)\b/.test(local) ||
			/\b(reply to|post to) the (list|group)\b|\bunsubscribe from this (list|group)\b/i.test(
				input.bodyText
			)
	},
	{
		category: 'social',
		reason: 'It is a notification about people you follow or know online.',
		test: (input) =>
			/\b(commented on|tagged you|started following|friend request|wants to connect|invited you to connect|mentioned you|new followers?)\b/i.test(
				`${input.subject} ${input.bodyText}`
			)
	},
	{
		category: 'updates',
		reason: 'It is a receipt, order, account or appointment notice.',
		test: (input) =>
			/\b(order #?\d+|receipt|statement|invoice|your (order|package|parcel|bill|flight|booking)|new sign-?in|password was changed|appointment|payment received)\b/i.test(
				`${input.subject} ${input.bodyText}`
			)
	},
	{
		category: 'promotions',
		reason: 'It advertises a sale, discount or coupon.',
		test: (input) =>
			/\b\d+% off\b|\bcoupon\b|\bpromo code\b|\buse code\b|\bsale\b|\bdeals?\b/i.test(
				`${input.subject} ${input.bodyText}`
			)
	}
];

/** The sender's local part (`deals` in deals@shop.example), lowercased. */
function localPart(email: string): string {
	return email.split('@')[0]?.toLowerCase() ?? '';
}

/** Content words plus sender and shape markers, which separate bulk mail from people. */
export function categoryFeatures(input: CategoryInput): string[] {
	const words = tokenize(`${input.subject}\n${input.bodyText}`, {
		removeStopwords: true,
		minLength: 2
	});
	const sender = tokenize(localPart(input.fromEmail)).map((token) => `from:${token}`);
	const extra: string[] = [];
	if (/^\s*\[[\w.-]+\]/.test(input.subject)) extra.push('__tag');
	if (/\d+%/.test(input.subject + input.bodyText)) extra.push('__percent');
	if (/#\d+/.test(input.subject + input.bodyText)) extra.push('__number');
	return [...words, ...sender, ...extra];
}

function sampleInput(sample: CategorySample): CategoryInput {
	return { fromEmail: sample.from, subject: sample.subject, bodyText: sample.body };
}

/** Trains a fresh model on the given samples (the seed corpus by default). Instant. */
export function trainCategoryModel(
	samples: readonly CategorySample[] = CATEGORY_CORPUS
): CategoryModel {
	const model = createNaiveBayes<Category>(CATEGORIES);
	for (const sample of samples) {
		learnNaiveBayes(model, categoryFeatures(sampleInput(sample)), sample.category);
	}
	return model;
}

/** Learns from the user moving a conversation to another tab. */
export function learnCategoryFeedback(
	model: CategoryModel,
	input: CategoryInput,
	category: Category
): void {
	learnNaiveBayes(model, categoryFeatures(input), category, CATEGORY_FEEDBACK_WEIGHT);
}

/**
 * Rules first, then Naive Bayes. A rule wins unless the model is very sure of
 * something else, which happens once the user has taught it otherwise.
 */
export function classifyCategory(model: CategoryModel, input: CategoryInput): CategoryVerdict {
	const features = categoryFeatures(input);
	const prediction = predictNaiveBayes(model, features);
	const probability = prediction.probabilities[prediction.label];
	const rule = RULES.find((r) => r.test(input, localPart(input.fromEmail)));
	const round = (value: number) => Math.round(value * 100) / 100;

	if (rule && (rule.category === prediction.label || probability < 0.9)) {
		const agrees = rule.category === prediction.label;
		return {
			value: rule.category,
			confidence: round(agrees ? Math.max(0.9, probability) : 0.8),
			explanation: rule.reason,
			source: agrees ? 'model' : 'heuristic'
		};
	}
	const words = explainNaiveBayes(model, features, prediction.label)
		.map((e) => e.token)
		.filter((token) => !token.startsWith('__') && !token.startsWith('from:'))
		.map((token) => `“${token}”`);
	const tab = TAB_NAMES[prediction.label];
	return {
		value: prediction.label,
		confidence: round(probability),
		explanation:
			words.length > 0
				? `Words like ${words.join(', ')} are typical of ${tab}.`
				: `It reads most like your ${tab} mail.`,
		source: 'model'
	};
}

/** Accuracy over labelled samples, with the rules and the model together. */
export function evaluateCategory(
	model: CategoryModel,
	samples: readonly CategorySample[]
): { accuracy: number; total: number } {
	const correct = samples.filter(
		(sample) => classifyCategory(model, sampleInput(sample)).value === sample.category
	).length;
	return { accuracy: correct / samples.length, total: samples.length };
}

/** The tab's display name, for explanations elsewhere (e.g. the zero-shot upgrade). */
export function tabName(category: Category): string {
	return TAB_NAMES[category];
}
