import type { Label, ThreadSummary } from '@nem/shared';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import LabelPicker from './LabelPicker.svelte';

const labels: Label[] = [
	{ id: 'w', name: 'Work', color: 'violet', parentId: null },
	{ id: 't', name: 'Travel', color: 'lime', parentId: null }
];
const threads = [{ labelIds: ['w'] }, { labelIds: ['w', 't'] }] as ThreadSummary[];

describe('LabelPicker', () => {
	it('starts from the threads and applies only the changes', async () => {
		const onapply = vi.fn();
		render(LabelPicker, { open: true, threads, labels, onapply });
		const work = screen.getByRole('checkbox', { name: 'Work' });
		const travel = screen.getByRole('checkbox', { name: 'Travel' });
		expect(work).toBeChecked();
		expect((travel as HTMLInputElement).indeterminate).toBe(true);

		await fireEvent.click(work);
		await fireEvent.click(travel);
		await fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
		expect(onapply).toHaveBeenCalledWith([
			{ op: 'addLabels', labelIds: ['t'] },
			{ op: 'removeLabels', labelIds: ['w'] }
		]);
	});

	it('creates a label inline and checks it', async () => {
		const onapply = vi.fn();
		const oncreate = vi.fn(async (name: string) => {
			const label: Label = { id: 'n', name, color: 'neutral', parentId: null };
			labels.push(label);
			return label;
		});
		const { rerender } = render(LabelPicker, { open: true, threads, labels, oncreate, onapply });
		await fireEvent.input(screen.getByLabelText('Find or create a label'), {
			target: { value: 'Receipts' }
		});
		expect(screen.queryByRole('checkbox')).toBeNull();
		await fireEvent.click(screen.getByRole('button', { name: 'Create "Receipts"' }));
		await vi.waitFor(() => expect(oncreate).toHaveBeenCalledWith('Receipts'));
		await rerender({ labels: [...labels] });
		expect(await screen.findByRole('checkbox', { name: 'Receipts' })).toBeChecked();
		await fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
		expect(onapply).toHaveBeenCalledWith([{ op: 'addLabels', labelIds: ['n'] }]);
	});
});
