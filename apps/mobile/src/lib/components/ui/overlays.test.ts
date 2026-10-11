import { fireEvent, render, screen } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import ActionSheet from './ActionSheet.svelte';
import BottomSheet from './BottomSheet.svelte';
import ConfirmDialog from './ConfirmDialog.svelte';
import Modal from './Modal.svelte';

const sheetContent = createRawSnippet(() => ({
	render: () => '<div><button>First</button><button>Last</button></div>'
}));

/** Renders a button that had focus before the overlay opened. */
function focusOpener() {
	const opener = document.createElement('button');
	document.body.append(opener);
	opener.focus();
	return opener;
}

describe('BottomSheet', () => {
	it('is a labelled modal dialog that takes focus and locks scroll', () => {
		render(BottomSheet, { open: true, title: 'Accounts', children: sheetContent });

		const dialog = screen.getByRole('dialog', { name: 'Accounts' });
		expect(dialog).toHaveAttribute('aria-modal', 'true');
		expect(screen.getByRole('button', { name: 'First' })).toHaveFocus();
		expect(document.body.style.overflow).toBe('hidden');
	});

	it('closes on Escape and returns focus to the opener', async () => {
		const opener = focusOpener();
		const onclose = vi.fn();
		render(BottomSheet, { open: true, title: 'Accounts', onclose, children: sheetContent });

		await fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
		await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

		expect(onclose).toHaveBeenCalledOnce();
		expect(opener).toHaveFocus();
		expect(document.body.style.overflow).toBe('');
		opener.remove();
	});

	it('keeps Tab inside the sheet', async () => {
		render(BottomSheet, { open: true, title: 'Accounts', children: sheetContent });
		const last = screen.getByRole('button', { name: 'Last' });
		last.focus();

		await fireEvent.keyDown(last, { key: 'Tab' });
		expect(screen.getByRole('button', { name: 'First' })).toHaveFocus();

		await fireEvent.keyDown(screen.getByRole('button', { name: 'First' }), {
			key: 'Tab',
			shiftKey: true
		});
		expect(last).toHaveFocus();
	});

	it('closes when dragged down far enough', async () => {
		const onclose = vi.fn();
		const { container } = render(BottomSheet, {
			open: true,
			title: 'Accounts',
			onclose,
			children: sheetContent
		});
		const header = container.querySelector('.header') as HTMLElement;

		await fireEvent.pointerDown(header, { button: 0, clientY: 100 });
		await fireEvent.pointerMove(window, { clientY: 400 });
		await fireEvent.pointerUp(window, { clientY: 400 });

		expect(onclose).toHaveBeenCalledOnce();
	});

	it('offers a resize button only with several snap points', () => {
		render(BottomSheet, {
			open: true,
			title: 'Accounts',
			snapPoints: [0.5, 0.9],
			children: sheetContent
		});

		expect(screen.getByRole('button', { name: 'Resize sheet' })).toBeInTheDocument();
	});
});

describe('Modal', () => {
	it('closes from the X button', async () => {
		const onclose = vi.fn();
		render(Modal, { open: true, title: 'Details', onclose });

		await fireEvent.click(screen.getByRole('button', { name: 'Close' }));

		expect(onclose).toHaveBeenCalledOnce();
	});

	it('ignores Escape when not dismissible', async () => {
		const onclose = vi.fn();
		render(Modal, { open: true, title: 'Details', dismissible: false, onclose });

		await fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

		expect(onclose).not.toHaveBeenCalled();
		expect(screen.getByRole('dialog')).toBeInTheDocument();
	});
});

describe('ConfirmDialog', () => {
	it('is an alertdialog with focus on Cancel', () => {
		render(ConfirmDialog, {
			open: true,
			title: 'Discard draft?',
			message: 'This cannot be undone.',
			onconfirm: vi.fn()
		});

		const dialog = screen.getByRole('alertdialog', { name: 'Discard draft?' });
		expect(dialog).toHaveAccessibleDescription('This cannot be undone.');
		expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
	});

	it('confirms and cancels', async () => {
		const onconfirm = vi.fn();
		const oncancel = vi.fn();
		render(ConfirmDialog, { open: true, title: 'Delete?', onconfirm, oncancel });

		await fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
		expect(onconfirm).toHaveBeenCalledOnce();
		expect(oncancel).not.toHaveBeenCalled();
	});

	it('treats Escape as cancel', async () => {
		const oncancel = vi.fn();
		render(ConfirmDialog, { open: true, title: 'Delete?', onconfirm: vi.fn(), oncancel });

		await fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Escape' });

		expect(oncancel).toHaveBeenCalledOnce();
	});
});

describe('ActionSheet', () => {
	it('runs the chosen action and closes', async () => {
		const onselect = vi.fn();
		const onclose = vi.fn();
		render(ActionSheet, {
			open: true,
			title: 'Message actions',
			actions: [
				{ label: 'Archive', onselect },
				{ label: 'Delete', destructive: true, disabled: true, onselect: vi.fn() }
			],
			onclose
		});

		expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled();
		await fireEvent.click(screen.getByRole('button', { name: 'Archive' }));

		expect(onselect).toHaveBeenCalledOnce();
		expect(onclose).toHaveBeenCalledOnce();
		await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
	});
});
