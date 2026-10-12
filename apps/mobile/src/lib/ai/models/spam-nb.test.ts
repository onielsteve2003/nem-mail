import { describe, expect, it } from 'vitest';
import { createNaiveBayes, learnNaiveBayes, predictNaiveBayes } from './naive-bayes';
import { checkPhishing, isPhishing, type PhishingInput } from './phishing';
import { SPAM_EVAL } from './spam-corpus';
import {
	classifySpam,
	evaluateSpam,
	learnSpamFeedback,
	spamProbability,
	trainSpamModel
} from './spam-nb';

function message(overrides: Partial<PhishingInput> = {}): PhishingInput {
	return {
		fromName: 'Ada',
		fromEmail: 'ada@example.com',
		subject: 'Lunch',
		bodyText: 'Are we still on for lunch on Thursday?',
		bodyHtml: null,
		...overrides
	};
}

describe('naive bayes', () => {
	it('learns counts and predicts the class with more evidence', () => {
		const model = createNaiveBayes(['a', 'b'] as const);
		learnNaiveBayes(model, ['apple', 'apple', 'pear'], 'a');
		learnNaiveBayes(model, ['stone', 'rock'], 'b');
		const prediction = predictNaiveBayes(model, ['apple']);
		expect(prediction.label).toBe('a');
		expect(prediction.probabilities.a + prediction.probabilities.b).toBeCloseTo(1);
	});

	it('survives a JSON round trip', () => {
		const model = trainSpamModel();
		const copy = JSON.parse(JSON.stringify(model));
		const text = 'Claim your free prize now';
		expect(spamProbability(copy, text)).toBeCloseTo(spamProbability(model, text));
	});
});

describe('spam evaluation', () => {
	it('reaches at least 90% accuracy on the held-out set', () => {
		const result = evaluateSpam(trainSpamModel(), SPAM_EVAL);
		console.info(
			`spam eval: accuracy ${result.accuracy.toFixed(3)}, precision ${result.precision.toFixed(3)}, recall ${result.recall.toFixed(3)} (n=${result.total})`
		);
		expect(result.accuracy).toBeGreaterThanOrEqual(0.9);
	});
});

describe('classifySpam', () => {
	const model = trainSpamModel();

	it('flags spam and names the words that gave it away', () => {
		const verdict = classifySpam(
			model,
			message({
				subject: 'CONGRATULATIONS! You have won',
				bodyText: 'Claim your prize now before it expires.'
			})
		);
		expect(verdict.value.isSpam).toBe(true);
		expect(verdict.source).toBe('model');
		expect(verdict.explanation).toMatch(/words common in spam: “(claim|prize|won)”/);
	});

	it('leaves normal mail alone', () => {
		const verdict = classifySpam(model, message());
		expect(verdict.value).toEqual({ isSpam: false, isPhishing: false });
		expect(verdict.confidence).toBeGreaterThan(0.5);
	});

	it('learns from a spam report, and a "Not spam" undoes it', () => {
		const text = 'Quarterly synergy webinar tickets available';
		const before = spamProbability(model, text);
		const copy = trainSpamModel();
		learnSpamFeedback(copy, text, true);
		expect(spamProbability(copy, text)).toBeGreaterThan(Math.max(before, 0.5));
		learnSpamFeedback(copy, text, false);
		expect(spamProbability(copy, text)).toBeLessThan(0.5);
	});
});

describe('phishing heuristics', () => {
	it('catches a link whose text names a different site', () => {
		const findings = checkPhishing(
			message({
				bodyHtml:
					'<p>Sign in at <a href="https://login.evil.example/x">www.northbank.example</a></p>'
			})
		);
		expect(findings.map((f) => f.signal)).toContain('link-mismatch');
		expect(isPhishing(findings)).toBe(true);
	});

	it('catches lookalike domains, IP links and credential requests with urgency', () => {
		const findings = checkPhishing(
			message({
				fromEmail: 'security@n0rthbank-verify.example',
				subject: 'Urgent: your account will be suspended',
				bodyText: 'Verify your password immediately at http://192.168.4.20/login'
			})
		);
		expect(findings.map((f) => f.signal)).toEqual([
			'ip-link',
			'lookalike-domain',
			'credential-request',
			'urgent-wording'
		]);
		const verdict = classifySpam(trainSpamModel(), {
			...message(),
			fromEmail: 'security@n0rthbank-verify.example'
		});
		expect(verdict.value.isPhishing).toBe(true);
		expect(verdict.explanation).toContain('swaps letters for numbers');
	});

	it('does not flag matching links, prices or a plain sign-in notice', () => {
		const findings = checkPhishing(
			message({
				fromEmail: 'news@lumen.example',
				bodyText: 'If this was you, no action is needed. Pay $1.99 for shipping.',
				bodyHtml:
					'<a href="https://shop.lumen.example/sale">lumen.example</a> <a href="https://x.example">Pay $1.99</a>'
			})
		);
		expect(findings).toEqual([]);
	});
});
