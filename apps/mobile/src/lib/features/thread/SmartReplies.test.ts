import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import SmartReplies from './SmartReplies.svelte';

describe('SmartReplies', () => {
	it('shows the replies as chips that start a reply when tapped', async () => {
		const onpick = vi.fn();
		const verdict = {
			value: [
				'Sounds good, see you then!',
				'Could we find another time?',
				"Sorry, I can't make it."
			],
			intent: 'meeting' as const,
			confidence: 0.8,
			explanation: 'It reads as a meeting request.',
			source: 'heuristic' as const
		};
		render(SmartReplies, { verdict, onpick });
		expect(screen.getByRole('region', { name: 'Suggested replies' })).toBeInTheDocument();
		await fireEvent.click(screen.getByRole('button', { name: 'Could we find another time?' }));
		expect(onpick).toHaveBeenCalledWith('Could we find another time?');
	});
});
