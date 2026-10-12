import { describe, expect, it } from 'vitest';
import { composeTitle } from './compose.js';

describe('composeTitle', () => {
	it('names the mode, and a new-message draft as Draft', () => {
		expect(composeTitle(null)).toBe('New message');
		expect(composeTitle({ mode: 'replyAll' })).toBe('Reply all');
		expect(composeTitle({ mode: 'new', draftId: 'd1' })).toBe('Draft');
		expect(composeTitle({ mode: 'forward', draftId: 'd1' })).toBe('Forward');
	});
});
