import { describe, expect, it } from 'vitest';
import { detectIntent, suggestReplies, type ReplyInput } from './smart-reply';

const input = (subject: string, text: string, extra: Partial<ReplyInput> = {}): ReplyInput => ({
	fromName: 'Ada Lovelace',
	fromEmail: 'ada@example.com',
	subject,
	text,
	...extra
});

describe('detectIntent', () => {
	it.each([
		['Quick sync', 'Are you available for a call tomorrow at 3?', 'meeting'],
		['Saturday', 'We are having a dinner party, would you like to come?', 'invitation'],
		['Budget', 'Can you approve the Q4 budget so we can sign off today?', 'approval'],
		['Deck', 'Could you please send me the slides?', 'request'],
		['Thank you!', 'Thanks so much for your help with the launch.', 'thanks'],
		['Big news', 'Congratulations on the promotion!', 'congrats'],
		['FYI', 'Heads up: the release shipped this morning.', 'update'],
		['Coffee place', 'Is the new place downtown any good?', 'question']
	] as const)('reads “%s: %s” as %s', (subject, text, intent) => {
		expect(detectIntent(input(subject, text)).intent).toBe(intent);
	});
});

describe('suggestReplies', () => {
	it('gives three replies for the intent, with the sender’s first name and a reason', () => {
		const verdict = suggestReplies(input('Thank you!', 'Thanks for your help.'))!;
		expect(verdict.value).toHaveLength(3);
		expect(verdict.value[0]).toBe("You're welcome, Ada!");
		expect(verdict.explanation).toContain('thank-you');
		expect(verdict.explanation).toContain('“thanks”');
		expect(verdict.source).toBe('heuristic');
	});

	it('falls back to general replies and drops a missing name cleanly', () => {
		const verdict = suggestReplies(input('Hello', 'Zzz.', { fromName: '' }))!;
		expect(verdict.intent).toBeNull();
		expect(verdict.value[0]).toBe('Thanks!');
	});

	it('offers nothing for no-reply senders and bulk mail', () => {
		expect(
			suggestReplies(input('Receipt', 'Thanks!', { fromEmail: 'no-reply@shop.example' }))
		).toBeNull();
		expect(suggestReplies(input('Deals', 'Big sale. Unsubscribe here.'))).toBeNull();
	});
});
