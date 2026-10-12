import type { Attachment } from '@nem/shared';
import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AttachmentList from './AttachmentList.svelte';

const attachments: Attachment[] = [
	{ id: 'a1', filename: 'IMG_42.jpg', mime: 'image/jpeg', size: 2048 },
	{ id: 'a2', filename: 'brief.pdf', mime: 'application/pdf', size: 3 * 1024 * 1024 }
];

describe('AttachmentList', () => {
	beforeEach(() => {
		URL.createObjectURL = vi.fn(() => 'blob:thumb');
		URL.revokeObjectURL = vi.fn();
	});
	afterEach(() => vi.restoreAllMocks());

	it('shows a thumbnail for images and opens the preview', async () => {
		const load = vi.fn(async () => new Blob(['x'], { type: 'image/svg+xml' }));
		render(AttachmentList, { attachments, load });

		expect(screen.getByRole('region', { name: '2 attachments' })).toBeInTheDocument();
		expect(screen.getByText('3 MB')).toBeInTheDocument();
		await fireEvent.click(await screen.findByRole('button', { name: 'Preview IMG_42.jpg' }));
		expect(screen.getByRole('dialog', { name: 'IMG_42.jpg' })).toBeInTheDocument();
		expect(screen.getByRole('img', { name: 'IMG_42.jpg' })).toHaveAttribute('src', 'blob:thumb');
	});

	it('downloads other files through a temporary link', async () => {
		const load = vi.fn(async () => new Blob(['x']));
		const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
		render(AttachmentList, { attachments: [attachments[1] as Attachment], load });

		const [open] = screen.getAllByRole('button', { name: 'Download brief.pdf' });
		await fireEvent.click(open as HTMLElement);
		await waitFor(() => expect(click).toHaveBeenCalledOnce());
		expect(load).toHaveBeenCalledWith('a2');
	});
});
