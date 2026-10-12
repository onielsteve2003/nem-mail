import { describe, expect, it } from 'vitest';
import {
	IMPORTANT_THRESHOLD,
	PRIORITY_FEATURES,
	isLogisticModel,
	learnPriorityFeedback,
	predictLogistic,
	scorePriority,
	simulateEngagement,
	trainLogistic,
	trainPriorityModel,
	type PriorityInput
} from './priority-lr';

const request: PriorityInput = {
	fromEmail: 'ada@example.com',
	subject: 'Can you review the budget today?',
	text: 'Please let me know by EOD.',
	isDirect: true,
	recipientCount: 2,
	messageCount: 2,
	category: 'primary',
	hasAttachments: false,
	senderFrequency: 12
};

const newsletter: PriorityInput = {
	fromEmail: 'newsletter@shop.example',
	subject: 'This week in deals',
	text: 'Fresh picks for you. Unsubscribe any time.',
	isDirect: false,
	recipientCount: 1,
	messageCount: 1,
	category: 'promotions',
	hasAttachments: false,
	senderFrequency: 0
};

describe('logistic regression', () => {
	it('learns a separable rule by gradient descent', () => {
		const samples = [
			{ x: [1, 0], y: 1 as const },
			{ x: [1, 1], y: 1 as const },
			{ x: [0, 1], y: 0 as const },
			{ x: [0, 0], y: 0 as const }
		];
		const model = trainLogistic(samples, 2, { epochs: 500, rate: 1 });
		expect(model.weights[0]).toBeGreaterThan(1);
		expect(predictLogistic(model, [1, 0])).toBeGreaterThan(0.8);
		expect(predictLogistic(model, [0, 1])).toBeLessThan(0.2);
	});

	it('fits simulated engagement well on samples it never saw', () => {
		const model = trainPriorityModel();
		const heldOut = simulateEngagement(400, 99);
		const correct = heldOut.filter(
			({ x, y }) => (predictLogistic(model, x) >= 0.5 ? 1 : 0) === y
		).length;
		expect(correct / heldOut.length).toBeGreaterThanOrEqual(0.75);
		const weight = (id: string) => model.weights[PRIORITY_FEATURES.findIndex((f) => f.id === id)]!;
		expect(weight('bulk')).toBeLessThan(0);
		expect(weight('senderFrequency')).toBeGreaterThan(0);
	});
});

describe('scorePriority', () => {
	const model = trainPriorityModel();

	it('rates a direct request from a frequent contact important, with reasons', () => {
		const verdict = scorePriority(model, request);
		expect(verdict.value).toBeGreaterThanOrEqual(IMPORTANT_THRESHOLD);
		expect(verdict.explanation).toMatch(/^Important because /);
		expect(verdict.source).toBe('model');
	});

	it('rates a newsletter low and says why', () => {
		const verdict = scorePriority(model, newsletter);
		expect(verdict.value).toBeLessThan(IMPORTANT_THRESHOLD);
		expect(verdict.explanation).toContain('bulk mail');
	});

	it('learns from Mark important and Mark not important', () => {
		const learned = trainPriorityModel();
		learnPriorityFeedback(learned, newsletter, true, 'mark');
		expect(scorePriority(learned, newsletter).value).toBeGreaterThanOrEqual(IMPORTANT_THRESHOLD);
		learnPriorityFeedback(learned, newsletter, false, 'mark');
		expect(scorePriority(learned, newsletter).value).toBeLessThan(IMPORTANT_THRESHOLD);
	});

	it('only accepts a saved model of the right shape', () => {
		expect(isLogisticModel(model)).toBe(true);
		expect(isLogisticModel({ kind: 'logistic', weights: [1] })).toBe(false);
		expect(isLogisticModel(undefined)).toBe(false);
	});
});
