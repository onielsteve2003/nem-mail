import type { Label } from '@nem/shared';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import LabelEditor from './LabelEditor.svelte';
import { LABEL_COPY } from './labels.js';

const LABELS: Label[] = [
	{ id: 'work', name: 'Work', color: 'lime', parentId: null },
	{ id: 'projects', name: 'Projects', color: 'cyan', parentId: 'work' }
];

function setup(label: Label | null) {
	const onsave = vi.fn();
	const ondelete = vi.fn();
	render(LabelEditor, { open: true, label, labels: LABELS, onsave, ondelete });
	return { onsave, ondelete };
}

describe('LabelEditor', () => {
	it('creates a nested label with a color', async () => {
		const { onsave } = setup(null);
		await fireEvent.input(screen.getByLabelText('Name'), { target: { value: ' Q4 ' } });
		await fireEvent.click(screen.getByLabelText('Coral'));
		await fireEvent.change(screen.getByLabelText('Nest under'), { target: { value: 'work' } });
		await fireEvent.click(screen.getByRole('button', { name: 'Create' }));
		expect(onsave).toHaveBeenCalledWith({ name: 'Q4', color: 'coral', parentId: 'work' });
	});

	it('shows a name clash under the field instead of saving', async () => {
		const { onsave } = setup(null);
		await fireEvent.input(screen.getByLabelText('Name'), { target: { value: 'work' } });
		await fireEvent.click(screen.getByRole('button', { name: 'Create' }));
		expect(screen.getByText(LABEL_COPY.taken)).toBeInTheDocument();
		expect(onsave).not.toHaveBeenCalled();
	});

	it('edits a label: a parent cannot nest, and Delete asks the parent', async () => {
		const { ondelete } = setup(LABELS[0]!);
		expect(screen.getByLabelText('Name')).toHaveValue('Work');
		expect(screen.getByLabelText('Nest under')).toBeDisabled();
		await fireEvent.click(screen.getByRole('button', { name: 'Delete label' }));
		expect(ondelete).toHaveBeenCalledWith(LABELS[0]);
	});
});
