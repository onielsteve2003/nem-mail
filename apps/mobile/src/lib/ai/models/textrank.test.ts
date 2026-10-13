import { describe, expect, it } from 'vitest';
import { actionItems, ownText, splitSentences, summarizeThread, textRank } from './textrank';

const thread = [
	{
		from: 'Ada',
		text: `Hi team,

The launch review moves to Thursday because the payments audit is not finished.
The payments audit needs two more days of testing on the checkout flow.
Lunch is on me this week.
Can you send the checkout test results by Wednesday?

Thanks,
Ada`
	},
	{
		from: 'Grace',
		text: `The checkout tests pass except the refund path, which the payments audit flagged.
I will fix the refund path tomorrow.

On Mon, Oct 12, 2026 at 9:00 AM Ada wrote:
> The launch review moves to Thursday.`
	}
];

describe('sentences', () => {
	it('keeps the writer’s own words: no quotes, reply headers, greetings or sign-offs', () => {
		expect(ownText(thread[1]!.text)).not.toContain('wrote:');
		const sentences = splitSentences(thread[0]!.text);
		expect(sentences[0]).toMatch(/^The launch review/);
		expect(sentences).not.toContain('Hi team,');
		expect(sentences.some((s) => s.startsWith('Thanks'))).toBe(false);
	});
});

describe('textRank', () => {
	it('ranks sentences that share the thread’s topic above an off-topic one', () => {
		const sentences = thread.flatMap((m) => splitSentences(m.text));
		const scores = textRank(sentences);
		const lunch = sentences.findIndex((s) => s.startsWith('Lunch'));
		const audit = sentences.findIndex((s) => s.startsWith('The payments audit'));
		expect(scores[audit]!).toBeGreaterThan(scores[lunch]!);
	});
});

describe('summarizeThread', () => {
	it('summarizes in reading order with action items and an explanation', () => {
		const verdict = summarizeThread(thread)!;
		expect(verdict.value.text).not.toContain('Lunch');
		expect(verdict.value.text.length).toBeGreaterThan(20);
		expect(verdict.value.actionItems).toEqual([
			'Ada: Can you send the checkout test results by Wednesday?'
		]);
		expect(verdict.explanation).toContain('TextRank');
		expect(verdict.source).toBe('model');
	});

	it('skips threads too short to need a summary', () => {
		expect(summarizeThread([{ from: 'Ada', text: 'See you at noon for lunch today.' }])).toBeNull();
	});

	it('lists the newest requests first, without duplicates', () => {
		const items = actionItems([
			{ from: 'Ada', text: 'Please review the deck. Please review the deck.' },
			{ from: 'Grace', text: 'Also, make sure the demo works on Friday.' }
		]);
		expect(items).toEqual([
			'Grace: make sure the demo works on Friday.',
			'Ada: Please review the deck.'
		]);
	});
});
