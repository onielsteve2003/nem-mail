import { describe, expect, it } from 'vitest';
import { completeText, composeTokens, isNgramModel, learnNgram, trainNgramModel } from './ngram.js';

describe('smart compose n-gram model', () => {
	it('marks sentence starts and keeps punctuation as tokens', () => {
		expect(composeTokens("Thanks. I'll call\nBye")).toEqual([
			'<s>',
			'Thanks',
			'.',
			'<s>',
			"I'll",
			'call',
			'<s>',
			'Bye'
		]);
	});

	it('finishes a common phrase from the seed corpus', () => {
		const model = trainNgramModel();
		expect(completeText(model, 'Let me know if you have any ')?.value).toBe('questions.');
		expect(completeText(model, 'Looking forward to hearing ')?.value).toBe('from you.');
	});

	it('finishes a word the user started, then keeps going', () => {
		const model = trainNgramModel();
		const verdict = completeText(model, 'I hope you are doing we');
		expect(verdict?.value).toBe('ll.');
		expect(verdict?.source).toBe('model');
		expect(verdict?.confidence).toBeGreaterThan(0);
	});

	it('stays quiet when no guess is likely', () => {
		const model = trainNgramModel();
		expect(completeText(model, '')).toBeNull();
		expect(completeText(model, 'The purple giraffe ')).toBeNull();
		expect(completeText(model, 'I hope you are doing w')).toBeNull();
	});

	it("learns the user's own phrasing from sent mail, skipping quotes", () => {
		const model = trainNgramModel();
		expect(completeText(model, 'The quarterly ')).toBeNull();
		learnNgram(model, 'The quarterly numbers look solid.\n> The quarterly plan is late');
		learnNgram(model, 'Sending the quarterly numbers look solid draft.');
		expect(completeText(model, 'I think the quarterly ')?.value).toBe('numbers look solid.');
		expect(isNgramModel(JSON.parse(JSON.stringify(model)))).toBe(true);
	});
});
