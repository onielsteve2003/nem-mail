import { fireEvent, render, screen } from '@testing-library/svelte';
import { createRawSnippet, flushSync } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import EmptyState from './EmptyState.svelte';
import ErrorState from './ErrorState.svelte';
import OfflineBanner from './OfflineBanner.svelte';

describe('EmptyState', () => {
	it('shows the title, message and action', () => {
		const action = createRawSnippet(() => ({ render: () => '<button>Clear search</button>' }));
		const { container } = render(EmptyState, {
			title: 'No results',
			message: 'Try different words.',
			illustration: 'search',
			action
		});

		expect(screen.getByRole('heading', { name: 'No results' })).toBeInTheDocument();
		expect(screen.getByText('Try different words.')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Clear search' })).toBeInTheDocument();
		expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
	});
});

describe('ErrorState', () => {
	it('is an alert with a working Retry', async () => {
		const onretry = vi.fn();
		render(ErrorState, { onretry });

		expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong');
		await fireEvent.click(screen.getByRole('button', { name: /Try again/ }));
		expect(onretry).toHaveBeenCalledOnce();
	});

	it('shows a busy Retry while retrying', () => {
		render(ErrorState, { onretry: vi.fn(), retrying: true });

		expect(screen.getByRole('button', { name: /Try again/ })).toHaveAttribute('aria-busy', 'true');
	});

	it('has no Retry without a handler', () => {
		render(ErrorState);

		expect(screen.queryByRole('button')).toBeNull();
	});
});

describe('OfflineBanner', () => {
	afterEach(() => vi.restoreAllMocks());

	it('appears when the browser goes offline and hides when back online', async () => {
		const onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
		render(OfflineBanner);
		expect(screen.queryByText(/offline/)).toBeNull();

		onLine.mockReturnValue(false);
		window.dispatchEvent(new Event('offline'));
		flushSync();
		expect(screen.getByRole('status')).toHaveTextContent("You're offline");

		onLine.mockReturnValue(true);
		window.dispatchEvent(new Event('online'));
		flushSync();
		await vi.waitFor(() => expect(screen.queryByText(/offline/)).toBeNull());
	});
});
