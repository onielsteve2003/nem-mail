import { applyThreadOp, type Label, type ThreadSummary } from '@nem/shared';
import { describe, expect, it } from 'vitest';
import {
	bulkToggles,
	filterLabels,
	labelChangeOps,
	labelStates,
	moveOps,
	snoozePresets
} from './thread-actions.js';

const thread = (overrides: Partial<ThreadSummary>) =>
	({
		isUnread: false,
		isStarred: false,
		isImportant: false,
		isMuted: false,
		...overrides
	}) as ThreadSummary;

describe('bulkToggles', () => {
	it('applies while any thread still needs it', () => {
		const ops = bulkToggles([thread({ isUnread: true, isStarred: true }), thread({})]);
		expect(ops.read.op).toBe('markRead');
		expect(ops.star.op).toBe('star');
		expect(ops.important.op).toBe('markImportant');
		expect(ops.mute.op).toBe('mute');
	});

	it('undoes when every thread already has it', () => {
		const all = thread({ isStarred: true, isImportant: true, isMuted: true });
		const ops = bulkToggles([all, all]);
		expect(ops.read.op).toBe('markUnread');
		expect(ops.star.op).toBe('unstar');
		expect(ops.important.op).toBe('markNotImportant');
		expect(ops.mute.op).toBe('unmute');
	});
});

describe('snoozePresets', () => {
	const at = (now: Date) => Object.fromEntries(snoozePresets(now).map((p) => [p.id, p.at]));

	it('offers later today, tomorrow, this weekend and next week on a weekday', () => {
		// Wednesday 14 Oct 2026, 10:20.
		expect(at(new Date(2026, 9, 14, 10, 20))).toEqual({
			later: new Date(2026, 9, 14, 13, 0),
			tomorrow: new Date(2026, 9, 15, 8, 0),
			weekend: new Date(2026, 9, 17, 8, 0),
			'next-week': new Date(2026, 9, 19, 8, 0)
		});
	});

	it('drops later today late at night and this weekend on a weekend', () => {
		// Saturday 17 Oct 2026, 22:10.
		expect(Object.keys(at(new Date(2026, 9, 17, 22, 10)))).toEqual(['tomorrow', 'next-week']);
	});

	it('skips to the following Monday when today is Monday', () => {
		expect(at(new Date(2026, 9, 12, 9, 0))['next-week']).toEqual(new Date(2026, 9, 19, 8, 0));
	});
});

describe('label picker helpers', () => {
	const labeled = (...labelIds: string[]) => ({ labelIds }) as ThreadSummary;

	it('gives each label all, some or none across the threads', () => {
		expect(labelStates([labeled('a', 'b'), labeled('a')], ['a', 'b', 'c'])).toEqual({
			a: 'all',
			b: 'some',
			c: 'none'
		});
	});

	it('adds newly checked labels, removes unchecked ones and leaves mixed ones alone', () => {
		const initial = { a: 'all', b: 'some', c: 'none', d: 'some' } as const;
		expect(labelChangeOps(initial, { a: 'none', b: 'all', c: 'all', d: 'some' })).toEqual([
			{ op: 'addLabels', labelIds: ['b', 'c'] },
			{ op: 'removeLabels', labelIds: ['a'] }
		]);
		expect(labelChangeOps(initial, { ...initial })).toEqual([]);
	});

	it('filters by name and keeps children under their parent', () => {
		const label = (id: string, name: string, parentId: string | null = null) =>
			({ id, name, parentId, color: 'neutral' }) as Label;
		const labels = [label('k', 'Kids', 'f'), label('w', 'Work'), label('f', 'Family')];
		expect(filterLabels(labels, '').map((l) => l.id)).toEqual(['f', 'k', 'w']);
		expect(filterLabels(labels, 'WO').map((l) => l.id)).toEqual(['w']);
	});
});

describe('moveOps', () => {
	it('maps each place to the ops that file the thread there', () => {
		expect(moveOps({ kind: 'mailbox', to: 'trash' })).toEqual([{ op: 'move', to: 'trash' }]);
		expect(moveOps({ kind: 'mailbox', to: 'archive' })).toEqual([
			{ op: 'move', to: 'inbox' },
			{ op: 'archive' }
		]);
		expect(moveOps({ kind: 'label', labelId: 'l1' })).toEqual([
			{ op: 'addLabels', labelIds: ['l1'] },
			{ op: 'move', to: 'inbox' },
			{ op: 'archive' }
		]);
		expect(moveOps({ kind: 'category', category: 'social' })).toEqual([
			{ op: 'move', to: 'inbox' },
			{ op: 'setCategory', category: 'social' }
		]);
	});

	it('takes a trashed thread to its label, out of Trash', () => {
		const trashed = { mailboxes: ['trash'], labelIds: [] as string[] } as unknown as ThreadSummary;
		const moved = moveOps({ kind: 'label', labelId: 'l1' }).reduce(applyThreadOp, trashed);
		expect(moved.mailboxes).toEqual([]);
		expect(moved.labelIds).toEqual(['l1']);
	});
});
