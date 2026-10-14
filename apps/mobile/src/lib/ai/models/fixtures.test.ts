import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CATEGORIES, tokenize } from '@nem/shared';
import { describe, expect, it } from 'vitest';
import { CATEGORY_CORPUS, CATEGORY_EVAL } from './category-corpus';
import { classifyCategory, trainCategoryModel } from './category';
import { extract } from './extract';
import { completeText, COMPOSE_SEED, learnNgram, trainNgramModel } from './ngram';
import { learnPriorityFeedback, scorePriority, trainPriorityModel } from './priority-lr';
import type { PriorityInput } from './priority-lr';
import { suggestReplies } from './smart-reply';
import { SPAM_CORPUS, SPAM_EVAL } from './spam-corpus';
import { classifySpam, learnSpamFeedback, spamProbability, trainSpamModel } from './spam-nb';
import { splitSentences, summarizeThread, textRank } from './textrank';

/**
 * The Java API runs ports of these models (T18.1). This file exports the corpora they train
 * on and what the TS models answer for a set of inputs; JUnit checks the ports against it.
 * `WRITE_AI_FIXTURES=1 npx vitest run fixtures` rewrites both files after a model change.
 */
const DIR = join(
	import.meta.dirname,
	'..',
	'..',
	'..',
	'..',
	'..',
	'..',
	'packages',
	'shared',
	'fixtures',
	'ai'
);

const PHISHING = {
	fromName: 'North Bank',
	fromEmail: 'security@n0rthbank.example',
	subject: 'Urgent: verify your account',
	bodyText: 'Your account will be suspended. Verify your password within 24 hours.',
	bodyHtml: '<p>Sign in at <a href="http://203.0.113.9/login">www.northbank.example</a></p>'
};

const SPAM_CASES = [
	PHISHING,
	{
		fromName: 'Prize Desk',
		fromEmail: 'winner@prizes.example',
		subject: 'CONGRATULATIONS winner!!!',
		bodyText: 'You won $5,000 cash. Claim your free prize now at https://prizes.example/claim',
		bodyHtml: null
	},
	{
		fromName: 'Ada Lovelace',
		fromEmail: 'ada@example.com',
		subject: 'Notes for Thursday',
		bodyText: 'Could you review the draft before our meeting? Thanks, Ada',
		bodyHtml: null
	},
	{
		fromName: 'Café Crème',
		fromEmail: 'hello@cafe.example',
		subject: '“Weekly” update',
		bodyText: 'Our new menu starts Monday. See you soon!',
		bodyHtml: '<a href="https://cafe.example/menu">cafe.example/menu</a>'
	}
];

const PRIORITY_CASES: PriorityInput[] = [
	{
		fromEmail: 'grace@example.org',
		subject: 'Contract to sign today',
		text: 'Can you approve this before EOD?',
		isDirect: true,
		recipientCount: 2,
		messageCount: 3,
		category: 'primary',
		hasAttachments: true,
		senderFrequency: 12
	},
	{
		fromEmail: 'newsletter@shop.example',
		subject: 'This week in deals',
		text: 'Big savings inside. Unsubscribe any time.',
		isDirect: false,
		recipientCount: 1,
		messageCount: 1,
		category: 'promotions',
		hasAttachments: false,
		senderFrequency: 0
	},
	{
		fromEmail: 'alerts@bank.example',
		subject: 'Statement ready',
		text: 'Your monthly statement is ready.',
		isDirect: true,
		recipientCount: 1,
		messageCount: 1,
		category: 'updates',
		hasAttachments: false,
		senderFrequency: 1
	},
	{
		fromEmail: 'team@example.com',
		subject: 'Lunch',
		text: 'Pizza on Friday',
		isDirect: false,
		recipientCount: 8,
		messageCount: 1,
		category: null,
		hasAttachments: false,
		senderFrequency: 0
	}
];

const COMPOSE_PREFIXES = [
	'Thank you for ',
	'Thanks for the',
	'Let me know if you',
	'I hope you',
	'Looking forw',
	'Sorry for the late reply. ',
	'Hi Ada,\nI just wanted to ',
	'Please find attached the',
	'xyz',
	'See you on Mon'
];

const REPLY_CASES = [
	{
		fromName: 'Grace Hopper',
		fromEmail: 'grace@example.org',
		subject: 'Quick sync?',
		text: 'Would Tuesday at 3pm work for you? We can meet in room 4.'
	},
	{
		fromName: 'Alan',
		fromEmail: 'alan@example.com',
		subject: 'Dinner Saturday',
		text: 'We are having a dinner party, would you like to come? Join us at 7.'
	},
	{
		fromName: 'Ada',
		fromEmail: 'ada@example.com',
		subject: 'Thank you!',
		text: 'Thanks so much for your help with the launch. Really appreciate it.'
	},
	{
		fromName: '',
		fromEmail: 'boss@example.com',
		subject: 'Budget',
		text: 'Please send the budget and review the plan. Can you share it today?'
	},
	{
		fromName: 'Shop',
		fromEmail: 'no-reply@shop.example',
		subject: 'Your order',
		text: 'Your order shipped.'
	},
	{ fromName: 'Bo', fromEmail: 'bo@example.com', subject: 'Hello', text: 'Nice weather here.' }
];

const THREADS = [
	[
		{
			from: 'Ada',
			text: 'Hi Grace,\nThe launch moved to next Tuesday because the payment review is not finished. The review team needs two more days to test the payment flow. Can you update the launch checklist by Friday?\nThanks, Ada'
		},
		{
			from: 'Grace',
			text: 'Sure. The payment flow tests found one bug in refunds. I will fix the refund bug tomorrow and rerun the payment tests. Please let me know if the launch date changes again.\n\nOn Mon, Ada wrote:\n> The launch moved to next Tuesday.'
		}
	],
	[{ from: 'Bo', text: 'Short note. Nothing much here.' }]
];

const EXTRACT_CASES = [
	{
		subject: 'Your login code',
		text: 'Your verification code is 482913. It expires in 10 minutes.',
		sentAt: '2026-03-04T12:00:00.000Z'
	},
	{
		subject: 'Shipped',
		text: 'Tracking number: 1Z999AA10123456784. Arrives tomorrow.',
		sentAt: '2026-03-06T12:00:00.000Z'
	},
	{
		subject: 'Team sync',
		text: 'Can we meet on Friday at 3pm? Otherwise March 20th, 10:30 works. The report is due 2026-04-01.',
		sentAt: '2026-03-06T12:00:00.000Z'
	},
	{
		subject: 'Dates',
		text: 'Book 5 Jan for the trip and the 31st of February is not real. Lunch next monday at 12pm.',
		sentAt: '2026-12-15T12:00:00.000Z'
	},
	{ subject: 'Hello', text: 'Nothing to see, 3 people came.', sentAt: '2026-03-06T12:00:00.000Z' }
];

const TOKENIZE_CASES = [
	{ text: 'Café “Crème” — don’t PANIC!  It’s 9 o’clock.', removeStopwords: false, minLength: 1 },
	{ text: 'The quick brown fox, and the lazy dog: a test', removeStopwords: true, minLength: 2 },
	{ text: 'naïve  résumé\tñandú 42x', removeStopwords: false, minLength: 1 }
];

function corpora() {
	return {
		categories: CATEGORIES,
		spamTraining: SPAM_CORPUS,
		spamEval: SPAM_EVAL,
		categoryTraining: CATEGORY_CORPUS,
		categoryEval: CATEGORY_EVAL,
		composeSeed: COMPOSE_SEED
	};
}

function expectations() {
	const spam = trainSpamModel();
	const spamCases = SPAM_CASES.map((input) => ({ input, verdict: classifySpam(spam, input) }));
	const evalProbabilities = SPAM_EVAL.map((sample) => spamProbability(spam, sample.text));
	const feedbackText = 'Team lunch on Friday, pizza for everyone';
	const before = spamProbability(spam, feedbackText);
	learnSpamFeedback(spam, feedbackText, true);
	const spamFeedback = { text: feedbackText, before, after: spamProbability(spam, feedbackText) };

	const category = trainCategoryModel();
	const categoryCases = CATEGORY_EVAL.map((sample) => ({
		input: { fromEmail: sample.from, subject: sample.subject, bodyText: sample.body },
		verdict: classifyCategory(category, {
			fromEmail: sample.from,
			subject: sample.subject,
			bodyText: sample.body
		})
	}));

	const priority = trainPriorityModel();
	const priorityModel = { weights: [...priority.weights], bias: priority.bias };
	const priorityCases = PRIORITY_CASES.map((input) => ({
		input,
		verdict: scorePriority(priority, input)
	}));
	const marked = PRIORITY_CASES[3] as PriorityInput;
	learnPriorityFeedback(priority, marked, true, 'mark');
	const priorityFeedback = {
		input: marked,
		weights: [...priority.weights],
		bias: priority.bias,
		verdict: scorePriority(priority, marked)
	};

	const ngram = trainNgramModel();
	const composeCases = COMPOSE_PREFIXES.map((before) => ({
		before,
		verdict: completeText(ngram, before)
	}));
	const learned = 'Cheers for the coffee yesterday.\nCheers for the coffee and cake.';
	learnNgram(ngram, learned);
	const composeLearned = {
		text: learned,
		cases: ['Cheers for', 'Cheers for the coffee '].map((before) => ({
			before,
			verdict: completeText(ngram, before)
		}))
	};

	const threadCases = THREADS.map((messages) => {
		const sentences = messages.flatMap((message) => splitSentences(message.text));
		return {
			messages,
			sentences,
			scores: textRank(sentences),
			verdict: summarizeThread(messages)
		};
	});

	return {
		tokenize: TOKENIZE_CASES.map((input) => ({
			input,
			tokens: tokenize(input.text, {
				removeStopwords: input.removeStopwords,
				minLength: input.minLength
			})
		})),
		spam: { cases: spamCases, evalProbabilities, feedback: spamFeedback },
		category: { cases: categoryCases },
		priority: { model: priorityModel, cases: priorityCases, feedback: priorityFeedback },
		compose: { cases: composeCases, learned: composeLearned },
		summary: { cases: threadCases },
		smartReply: {
			cases: REPLY_CASES.map((input) => ({ input, verdict: suggestReplies(input) }))
		},
		extract: { cases: EXTRACT_CASES.map((input) => ({ input, verdict: extract(input) })) }
	};
}

function check(name: string, value: unknown): void {
	const file = join(DIR, name);
	const json = `${JSON.stringify(value, null, '\t')}\n`;
	if (process.env.WRITE_AI_FIXTURES) writeFileSync(file, json);
	const saved: unknown = JSON.parse(readFileSync(file, 'utf8'));
	expect(saved, `run WRITE_AI_FIXTURES=1 npx vitest run fixtures in apps/mobile`).toEqual(
		JSON.parse(json)
	);
}

describe('packages/shared/fixtures/ai', () => {
	it('holds the corpora the Java models train on', () => {
		check('corpora.json', corpora());
	});

	it('holds what the TS models answer, for the Java ports to match', () => {
		check('models.json', expectations());
	});
});
