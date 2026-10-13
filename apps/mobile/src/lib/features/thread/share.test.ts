import type { Thread } from '@nem/shared';
import { describe, expect, it } from 'vitest';
import { threadShareContent } from './share.js';

const thread = {
	subject: 'Quarterly plan',
	snippet: 'See you Monday',
	messages: [
		{ from: { email: 'ada@example.com' }, bodyText: 'First' },
		{ from: { email: 'grace@example.com', name: 'Grace' }, bodyText: ' See you Monday. \n' }
	]
} as unknown as Thread;

describe('threadShareContent', () => {
	it('shares the subject and the latest message with its sender', () => {
		expect(threadShareContent(thread)).toEqual({
			title: 'Quarterly plan',
			text: 'Grace:\nSee you Monday.'
		});
	});

	it('falls back to the snippet and a placeholder subject', () => {
		expect(threadShareContent({ ...thread, subject: '', messages: [] })).toEqual({
			title: '(no subject)',
			text: 'See you Monday'
		});
	});
});
