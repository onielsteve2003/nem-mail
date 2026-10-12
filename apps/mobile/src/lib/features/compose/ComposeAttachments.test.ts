import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import type { ComposeAttachment } from './attachments.js';
import ComposeAttachments from './ComposeAttachments.svelte';

const base = { mime: 'application/pdf', size: 2048, attachment: null, error: null, progress: 0 };
const ITEMS: ComposeAttachment[] = [
	{ ...base, key: 'a', filename: 'plan.pdf', status: 'uploading', progress: 0.4 },
	{ ...base, key: 'b', filename: 'huge.zip', status: 'error', error: 'Over 10 MB (12 MB)' },
	{ ...base, key: 'c', filename: 'flaky.pdf', status: 'error', error: 'Upload failed' }
];

describe('ComposeAttachments', () => {
	it('shows progress, errors, retry only where allowed, and removes', async () => {
		const onremove = vi.fn();
		const onretry = vi.fn();
		render(ComposeAttachments, {
			items: ITEMS,
			onremove,
			onretry,
			canRetry: (key: string) => key === 'c'
		});
		expect(screen.getByRole('list', { name: '3 attachments' })).toBeInTheDocument();
		expect(screen.getByRole('progressbar', { name: 'Uploading plan.pdf' })).toHaveAttribute(
			'aria-valuenow',
			'40'
		);
		expect(screen.getByText('Over 10 MB (12 MB)')).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Retry huge.zip' })).toBeNull();
		await fireEvent.click(screen.getByRole('button', { name: 'Retry flaky.pdf' }));
		expect(onretry).toHaveBeenCalledWith('c');
		await fireEvent.click(screen.getByRole('button', { name: 'Remove huge.zip' }));
		expect(onremove).toHaveBeenCalledWith('b');
	});
});
