import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import SummaryCard from './SummaryCard.svelte';

const verdict = {
	value: { text: 'The launch review moves to Thursday.', actionItems: ['Ada: Send the results.'] },
	confidence: 0.7,
	explanation: 'TextRank picked the 2 most central of 5 sentences.',
	source: 'model' as const
};

describe('SummaryCard', () => {
	it('shows the summary, action items and a dismiss button', async () => {
		const ondismiss = vi.fn();
		render(SummaryCard, { verdict, ondismiss });
		const card = screen.getByRole('region', { name: 'Summary' });
		expect(card).toHaveTextContent('The launch review moves to Thursday.');
		expect(screen.getByRole('list', { name: 'Action items' })).toHaveTextContent(
			'Send the results.'
		);
		await fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
		expect(ondismiss).toHaveBeenCalledOnce();
	});

	it('shows progress, then an error with Retry', async () => {
		const { rerender } = render(SummaryCard, { verdict: null, isLoading: true });
		expect(screen.getByRole('status')).toHaveTextContent('Summarizing');
		const onretry = vi.fn();
		await rerender({ verdict: null, isLoading: false, error: true, onretry });
		expect(screen.getByRole('alert')).toHaveTextContent("Couldn't summarize");
		await fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
		expect(onretry).toHaveBeenCalledOnce();
	});
});
