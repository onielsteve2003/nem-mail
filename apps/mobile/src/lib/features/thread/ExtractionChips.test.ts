import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import ExtractionChips from './ExtractionChips.svelte';

describe('ExtractionChips', () => {
	it('copies a code and opens tracking from the chips', async () => {
		const writeText = vi.fn(async () => {});
		Object.assign(navigator, { clipboard: { writeText } });
		const open = vi.spyOn(window, 'open').mockReturnValue(null);
		const verdict = {
			value: [
				{ kind: 'otp' as const, text: '482913', value: '482913' },
				{ kind: 'tracking' as const, text: 'PX1234567890', value: 'PX1234567890' }
			],
			confidence: 0.9,
			explanation:
				'Found a one-time code and a tracking number by pattern matching on this device.',
			source: 'heuristic' as const
		};
		render(ExtractionChips, { verdict, subject: 'Your code' });
		expect(screen.getByRole('region', { name: 'Quick actions' })).toBeInTheDocument();
		await fireEvent.click(screen.getByRole('button', { name: 'Copy code 482913' }));
		expect(writeText).toHaveBeenCalledWith('482913');
		await fireEvent.click(screen.getByRole('button', { name: 'Track PX1234567890' }));
		expect(open).toHaveBeenCalledWith(
			'https://parcelsapp.com/en/tracking/PX1234567890',
			'_blank',
			'noopener,noreferrer'
		);
		open.mockRestore();
	});
});
