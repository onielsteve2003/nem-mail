import { describe, expect, it } from 'vitest';
import { CATEGORY_EVAL } from './category-corpus';
import {
	classifyCategory,
	evaluateCategory,
	learnCategoryFeedback,
	trainCategoryModel,
	type CategoryInput
} from './category';

const input = (fromEmail: string, subject: string, bodyText: string): CategoryInput => ({
	fromEmail,
	subject,
	bodyText
});

describe('category evaluation', () => {
	it('reaches at least 80% accuracy on the held-out set', () => {
		const result = evaluateCategory(trainCategoryModel(), CATEGORY_EVAL);
		console.info(`category eval: accuracy ${result.accuracy.toFixed(3)} (n=${result.total})`);
		expect(result.accuracy).toBeGreaterThanOrEqual(0.8);
	});
});

describe('classifyCategory', () => {
	const model = trainCategoryModel();

	it('uses rules for list tags, social notices, orders and coupons', () => {
		const cases: [CategoryInput, string][] = [
			[input('ann@example.com', '[book-club] March pick', 'Vote below.'), 'forums'],
			[input('x@pics.example', 'Ben tagged you', 'See the photo.'), 'social'],
			[input('shop@a.example', 'Your receipt', 'Thanks for shopping.'), 'updates'],
			[input('hi@a.example', 'Use code SAVE10', 'Treat yourself.'), 'promotions']
		];
		for (const [message, expected] of cases) {
			const verdict = classifyCategory(model, message);
			expect(verdict.value).toBe(expected);
			expect(verdict.confidence).toBeGreaterThanOrEqual(0.8);
			expect(verdict.explanation.length).toBeGreaterThan(0);
		}
	});

	it('falls back to the model and names the words behind it', () => {
		const verdict = classifyCategory(
			model,
			input('jo@example.com', 'Coffee tomorrow?', 'Could we meet for coffee and review the draft?')
		);
		expect(verdict.value).toBe('primary');
		expect(verdict.source).toBe('model');
		expect(verdict.explanation).toMatch(/typical of Primary|most like your Primary/);
	});

	it('learns when the user moves mail to another tab', () => {
		const copy = trainCategoryModel();
		const message = input(
			'team@guild.example',
			'Raid night recap',
			'Great run last night, loot below.'
		);
		learnCategoryFeedback(copy, message, 'forums');
		learnCategoryFeedback(copy, message, 'forums');
		expect(classifyCategory(copy, message).value).toBe('forums');
	});
});
