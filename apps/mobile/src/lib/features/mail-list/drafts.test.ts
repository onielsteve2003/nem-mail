import type { Draft } from '@nem/shared';
import { describe, expect, it } from 'vitest';
import { NO_RECIPIENTS, draftRecipients, draftSnippet } from './drafts.js';

const draft = (to: Draft['to']) => ({ to, cc: [], bcc: [] }) as unknown as Draft;

describe('drafts', () => {
	it('names recipients or says there are none', () => {
		expect(draftRecipients(draft([{ email: 'ada@nem.dev', name: 'Ada Lovelace' }]))).toBe(
			'To: Ada Lovelace'
		);
		expect(draftRecipients(draft([]))).toBe(NO_RECIPIENTS);
	});

	it('turns the body into one line of text', () => {
		expect(draftSnippet('<p>Hi <b>Ada</b>,</p>\n<p>See   you</p>')).toBe('Hi Ada, See you');
	});
});
