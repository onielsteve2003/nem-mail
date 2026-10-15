import { describe, expect, it } from 'vitest';
import { draftKey, newDraftId, toDraft, type DraftFields } from './draft.js';
import { parseRecipient } from './recipients.js';

const recipient = (raw: string) => parseRecipient(raw)!;
const FIELDS: DraftFields = {
	to: [recipient('Ada <ada@example.com>'), recipient('nope')],
	cc: [],
	bcc: [recipient('grace@example.com')],
	subject: 'Plan',
	bodyHtml: '<p>Hi</p>',
	attachments: [{ id: 'att-1', filename: 'a.pdf', mime: 'application/pdf', size: 1 }]
};
const META = { id: 'draft-1', mode: 'reply' as const, threadId: 't1', inReplyTo: 'm1' };

describe('compose drafts', () => {
	it('builds a draft with valid recipients only', () => {
		const draft = toDraft(FIELDS, META, new Date('2026-10-12T10:00:00.000Z'));
		expect(draft).toEqual({
			...META,
			to: [{ email: 'ada@example.com', name: 'Ada' }],
			cc: [],
			bcc: [{ email: 'grace@example.com' }],
			subject: 'Plan',
			bodyHtml: '<p>Hi</p>',
			attachments: FIELDS.attachments,
			scheduledAt: null,
			updatedAt: '2026-10-12T10:00:00.000Z'
		});
	});

	it('changes the key only when a field changes', () => {
		const key = draftKey(FIELDS);
		expect(draftKey({ ...FIELDS, to: [...FIELDS.to] })).toBe(key);
		expect(draftKey({ ...FIELDS, subject: 'Plan!' })).not.toBe(key);
		expect(draftKey({ ...FIELDS, attachments: [] })).not.toBe(key);
		expect(draftKey({ ...FIELDS, cc: [recipient('x@example.com')] })).not.toBe(key);
	});

	it('makes unique draft ids', () => {
		expect(newDraftId()).not.toBe(newDraftId());
		expect(newDraftId()).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
		);
	});
});
