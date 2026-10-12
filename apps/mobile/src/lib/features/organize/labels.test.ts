import type { Label } from '@nem/shared';
import { describe, expect, it } from 'vitest';
import { LABEL_COPY, labelProblem, parentChoices } from './labels.js';

const label = (id: string, name: string, parentId: string | null = null): Label => ({
	id,
	name,
	color: 'neutral',
	parentId
});
const LABELS = [
	label('work', 'Work'),
	label('projects', 'Projects', 'work'),
	label('family', 'Family'),
	label('travel', 'Travel')
];

describe('labelProblem', () => {
	it('needs a name of up to 50 characters', () => {
		expect(labelProblem({ name: '  ', parentId: null }, LABELS)).toBe(LABEL_COPY.empty);
		expect(labelProblem({ name: 'x'.repeat(51), parentId: null }, LABELS)).toBe(LABEL_COPY.tooLong);
		expect(labelProblem({ name: 'Receipts', parentId: null }, LABELS)).toBeNull();
	});

	it('rejects a sibling with the same name, ignoring case, but not elsewhere', () => {
		expect(labelProblem({ name: 'work', parentId: null }, LABELS)).toBe(LABEL_COPY.taken);
		expect(labelProblem({ name: 'Projects', parentId: 'family' }, LABELS)).toBeNull();
		// Renaming a label to its own name is fine.
		expect(labelProblem({ name: 'WORK', parentId: null }, LABELS, 'work')).toBeNull();
	});

	it('nests only one level deep', () => {
		expect(labelProblem({ name: 'Q4', parentId: 'projects' }, LABELS)).toBe(LABEL_COPY.noParent);
		expect(labelProblem({ name: 'Q4', parentId: 'gone' }, LABELS)).toBe(LABEL_COPY.noParent);
		expect(labelProblem({ name: 'Q4', parentId: 'work' }, LABELS)).toBeNull();
	});
});

describe('parentChoices', () => {
	it('offers top-level labels other than itself, by name', () => {
		expect(parentChoices(LABELS).map((l) => l.id)).toEqual(['family', 'travel', 'work']);
		expect(parentChoices(LABELS, 'travel').map((l) => l.id)).toEqual(['family', 'work']);
	});

	it('offers none for a label that has children', () => {
		expect(parentChoices(LABELS, 'work')).toEqual([]);
	});
});
