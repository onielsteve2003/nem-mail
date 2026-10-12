import type { Label } from '@nem/shared';
import { describe, expect, it } from 'vitest';
import { MAILBOX_NAV, labelTree, mailboxTitle } from './nav.js';

const label = (id: string, name: string, parentId: string | null = null): Label => ({
	id,
	name,
	color: 'neutral',
	parentId
});

describe('MAILBOX_NAV', () => {
	it('lists every system mailbox once', () => {
		expect(new Set(MAILBOX_NAV.map((item) => item.mailbox)).size).toBe(11);
		expect(mailboxTitle('all')).toBe('All mail');
	});
});

describe('labelTree', () => {
	it('puts children under their parent, both sorted by name', () => {
		const tree = labelTree([
			label('b', 'Travel'),
			label('c2', 'Zeta', 'a'),
			label('a', 'Projects'),
			label('c1', 'Alpha', 'a')
		]);
		expect(tree.map((item) => [item.label.name, item.depth])).toEqual([
			['Projects', 0],
			['Alpha', 1],
			['Zeta', 1],
			['Travel', 0]
		]);
	});

	it('lifts a child whose parent is missing to the top level', () => {
		expect(labelTree([label('x', 'Orphan', 'gone')])).toEqual([
			{ label: label('x', 'Orphan', 'gone'), depth: 0 }
		]);
	});
});
