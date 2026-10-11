import { generateSeed, type Thread } from '@nem/shared';
import { describe, expect, it } from 'vitest';
import { applyThreadOp, inMailbox, matchesFilter } from './thread-ops.js';

const NOW = Date.parse('2026-10-11T09:00:00.000Z');
const threads = generateSeed({ now: new Date(NOW) }).accounts[0]?.threads ?? [];
const inboxThread = threads.find(
	(t) => t.mailboxes.includes('inbox') && t.snoozedUntil === null && t.messages.length > 1
) as Thread;

describe('applyThreadOp', () => {
	it('does not change its input', () => {
		const copy = structuredClone(inboxThread);
		applyThreadOp(inboxThread, { op: 'trash' });
		expect(inboxThread).toEqual(copy);
	});

	it('moves between inbox, spam and trash, keeping other mailboxes', () => {
		const sentToo: Thread = { ...inboxThread, mailboxes: ['inbox', 'sent'] };
		expect(applyThreadOp(sentToo, { op: 'trash' }).mailboxes).toEqual(['sent', 'trash']);
		expect(applyThreadOp(sentToo, { op: 'spam' }).mailboxes).toEqual(['sent', 'spam']);
		const trashed = applyThreadOp(sentToo, { op: 'move', to: 'trash' });
		expect(applyThreadOp(trashed, { op: 'move', to: 'inbox' }).mailboxes).toEqual([
			'inbox',
			'sent'
		]);
		expect(applyThreadOp(trashed, { op: 'notSpam' }).mailboxes).toEqual(['inbox', 'sent']);
		expect(applyThreadOp(sentToo, { op: 'archive' }).mailboxes).toEqual(['sent']);
	});

	it('toggles flags', () => {
		expect(applyThreadOp(inboxThread, { op: 'star' }).isStarred).toBe(true);
		expect(applyThreadOp(inboxThread, { op: 'unstar' }).isStarred).toBe(false);
		expect(applyThreadOp(inboxThread, { op: 'markImportant' }).isImportant).toBe(true);
		expect(applyThreadOp(inboxThread, { op: 'markNotImportant' }).isImportant).toBe(false);
		expect(applyThreadOp(inboxThread, { op: 'setCategory', category: 'social' }).category).toBe(
			'social'
		);
	});

	it('mutes out of the inbox and unmutes without moving back', () => {
		const muted = applyThreadOp(inboxThread, { op: 'mute' });
		expect(muted.isMuted).toBe(true);
		expect(muted.mailboxes).not.toContain('inbox');
		const unmuted = applyThreadOp(muted, { op: 'unmute' });
		expect(unmuted.isMuted).toBe(false);
		expect(unmuted.mailboxes).not.toContain('inbox');
	});

	it('adds and removes labels without duplicates', () => {
		const added = applyThreadOp(
			{ ...inboxThread, labelIds: ['a'] },
			{ op: 'addLabels', labelIds: ['a', 'b'] }
		);
		expect(added.labelIds).toEqual(['a', 'b']);
		expect(applyThreadOp(added, { op: 'removeLabels', labelIds: ['a'] }).labelIds).toEqual(['b']);
	});

	it('snoozes an archived thread back into the inbox and hides it until then', () => {
		const until = new Date(NOW + 3_600_000).toISOString();
		const archived = applyThreadOp(inboxThread, { op: 'archive' });
		const snoozed = applyThreadOp(archived, { op: 'snooze', until });
		expect(snoozed.mailboxes).toContain('inbox');
		expect(inMailbox(snoozed, 'inbox', NOW)).toBe(false);
		expect(inMailbox(snoozed, 'snoozed', NOW)).toBe(true);
		// Wakes up once the time passes.
		expect(inMailbox(snoozed, 'inbox', NOW + 7_200_000)).toBe(true);
		expect(inMailbox(snoozed, 'snoozed', NOW + 7_200_000)).toBe(false);
		expect(applyThreadOp(snoozed, { op: 'unsnooze' }).snoozedUntil).toBeNull();
	});
});

describe('inMailbox and matchesFilter', () => {
	it('hides spam and trash from every other view', () => {
		const trashed: Thread = { ...inboxThread, mailboxes: ['sent', 'trash'], isStarred: true };
		for (const mailbox of ['sent', 'starred', 'all'] as const) {
			expect(inMailbox(trashed, mailbox, NOW)).toBe(false);
		}
		expect(inMailbox(trashed, 'trash', NOW)).toBe(true);
		expect(matchesFilter({ ...trashed, labelIds: ['x'] }, { labelId: 'x' }, NOW)).toBe(false);
	});

	it('narrows the inbox by tab', () => {
		const category = inboxThread.category ?? 'primary';
		expect(matchesFilter(inboxThread, { mailbox: 'inbox', category }, NOW)).toBe(true);
		const other = category === 'social' ? 'forums' : 'social';
		expect(matchesFilter(inboxThread, { mailbox: 'inbox', category: other }, NOW)).toBe(false);
	});
});
