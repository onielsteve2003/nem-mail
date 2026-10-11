import { fireEvent, render, screen } from '@testing-library/svelte';
import { flushSync } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import { ToastStore } from '#lib/stores/toast.svelte.js';
import ProgressBar from './ProgressBar.svelte';
import Skeleton from './Skeleton.svelte';
import Spinner from './Spinner.svelte';
import Toaster from './Toaster.svelte';

describe('Toaster', () => {
	it('announces the current toast and runs its action', async () => {
		const store = new ToastStore();
		const onaction = vi.fn();
		render(Toaster, { store });

		store.show({ message: 'Archived 1 conversation', action: { label: 'Undo', onaction } });
		flushSync();

		expect(screen.getByRole('status')).toHaveTextContent('Archived 1 conversation');
		await fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
		expect(onaction).toHaveBeenCalledOnce();
		expect(store.current).toBeUndefined();
	});

	it('uses an alert for errors and can be dismissed', async () => {
		const store = new ToastStore();
		render(Toaster, { store });

		store.show({ message: 'Could not send', tone: 'error' });
		flushSync();

		expect(screen.getByRole('alert')).toHaveTextContent('Could not send');
		await fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
		expect(store.current).toBeUndefined();
		store.clear();
	});
});

describe('Skeleton', () => {
	it('draws the requested lines, hidden from assistive tech', () => {
		const { container } = render(Skeleton, { lines: 3 });

		expect(container.querySelectorAll('.bone')).toHaveLength(3);
		expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
	});
});

describe('Spinner', () => {
	it('is a status with a label, decorative without one', () => {
		const { unmount } = render(Spinner, { label: 'Loading mail' });
		expect(screen.getByRole('status')).toHaveTextContent('Loading mail');
		unmount();

		const { container } = render(Spinner);
		expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
	});
});

describe('ProgressBar', () => {
	it('reports a clamped percentage', () => {
		render(ProgressBar, { label: 'Downloading model', value: 1.4 });

		const bar = screen.getByRole('progressbar', { name: 'Downloading model' });
		expect(bar).toHaveAttribute('aria-valuenow', '100');
	});

	it('has no value when indeterminate', () => {
		render(ProgressBar, { label: 'Syncing' });

		expect(screen.getByRole('progressbar')).not.toHaveAttribute('aria-valuenow');
	});
});
