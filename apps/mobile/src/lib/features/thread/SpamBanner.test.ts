import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import SpamBanner from './SpamBanner.svelte';

const verdict = (isSpam: boolean, isPhishing = false) => ({
	value: { isSpam, isPhishing },
	confidence: 0.94,
	explanation: 'It uses words common in spam: “prize”.',
	source: 'model' as const
});

describe('SpamBanner', () => {
	it('explains the verdict and offers Not spam', async () => {
		const onnotspam = vi.fn();
		render(SpamBanner, { verdict: verdict(true), onnotspam });
		expect(screen.getByRole('region', { name: 'Why this is in Spam' })).toHaveTextContent(
			'words common in spam: “prize”'
		);
		await fireEvent.click(screen.getByRole('button', { name: 'Not spam' }));
		expect(onnotspam).toHaveBeenCalledOnce();
	});

	it('says when the filter did not flag a message the user moved, and titles phishing', () => {
		const { unmount } = render(SpamBanner, { verdict: verdict(false), onnotspam: vi.fn() });
		expect(screen.getByText(/didn't flag it/)).toBeInTheDocument();
		unmount();
		render(SpamBanner, { verdict: verdict(true, true), onnotspam: vi.fn() });
		expect(screen.getByRole('region', { name: 'Possible phishing' })).toBeInTheDocument();
	});

	it('shows progress while checking', () => {
		render(SpamBanner, { verdict: null, isLoading: true, onnotspam: vi.fn() });
		expect(screen.getByRole('status')).toHaveTextContent('Checking this message');
	});
});
