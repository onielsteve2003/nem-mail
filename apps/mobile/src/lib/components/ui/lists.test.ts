import { fireEvent, render, screen } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ContextMenu from './ContextMenu.svelte';
import Divider from './Divider.svelte';
import ListItem from './ListItem.svelte';
import Popover from './Popover.svelte';
import SectionHeader from './SectionHeader.svelte';

const popoverContent = createRawSnippet(() => ({
	render: () => '<div><button>Inside</button></div>'
}));

function makeAnchor() {
	const anchor = document.createElement('button');
	anchor.textContent = 'More';
	document.body.append(anchor);
	anchor.focus();
	return anchor;
}

afterEach(() => {
	document.body.innerHTML = '';
});

describe('Popover', () => {
	it('moves focus inside and closes on Escape, returning focus to the anchor', async () => {
		const anchor = makeAnchor();
		const onclose = vi.fn();
		render(Popover, { props: { open: true, anchor, onclose, children: popoverContent } });

		const inside = screen.getByRole('button', { name: 'Inside' });
		await vi.waitFor(() => expect(inside).toHaveFocus());

		await fireEvent.keyDown(inside, { key: 'Escape' });
		await vi.waitFor(() => expect(screen.queryByRole('button', { name: 'Inside' })).toBeNull());
		expect(onclose).toHaveBeenCalledOnce();
		expect(anchor).toHaveFocus();
	});

	it('closes on a tap outside, but not on the anchor', async () => {
		const anchor = makeAnchor();
		const onclose = vi.fn();
		render(Popover, { props: { open: true, anchor, onclose, children: popoverContent } });

		await fireEvent.pointerDown(anchor);
		expect(onclose).not.toHaveBeenCalled();

		await fireEvent.pointerDown(document.body);
		expect(onclose).toHaveBeenCalledOnce();
	});

	it('renders nothing without an anchor', () => {
		render(Popover, { props: { open: true, children: popoverContent } });
		expect(screen.queryByRole('button', { name: 'Inside' })).toBeNull();
	});
});

describe('ContextMenu', () => {
	const items = () => [
		{ label: 'Reply', onselect: vi.fn() },
		{ label: 'Forward', disabled: true, onselect: vi.fn() },
		{ label: 'Delete', destructive: true, onselect: vi.fn() }
	];

	it('is a labelled menu that focuses the first item', async () => {
		render(ContextMenu, {
			props: { open: true, anchor: makeAnchor(), label: 'Message actions', items: items() }
		});

		expect(screen.getByRole('menu', { name: 'Message actions' })).toBeInTheDocument();
		expect(screen.getAllByRole('menuitem')).toHaveLength(3);
		await vi.waitFor(() => expect(screen.getByRole('menuitem', { name: 'Reply' })).toHaveFocus());
	});

	it('moves with arrow keys, skipping disabled items and wrapping', async () => {
		render(ContextMenu, {
			props: { open: true, anchor: makeAnchor(), label: 'Actions', items: items() }
		});
		const menu = screen.getByRole('menu');
		await vi.waitFor(() => expect(screen.getByRole('menuitem', { name: 'Reply' })).toHaveFocus());

		await fireEvent.keyDown(menu, { key: 'ArrowDown' });
		expect(screen.getByRole('menuitem', { name: 'Delete' })).toHaveFocus();
		await fireEvent.keyDown(menu, { key: 'ArrowDown' });
		expect(screen.getByRole('menuitem', { name: 'Reply' })).toHaveFocus();
		await fireEvent.keyDown(menu, { key: 'ArrowUp' });
		expect(screen.getByRole('menuitem', { name: 'Delete' })).toHaveFocus();
		await fireEvent.keyDown(menu, { key: 'Home' });
		expect(screen.getByRole('menuitem', { name: 'Reply' })).toHaveFocus();
	});

	it('runs the item, closes and returns focus on select', async () => {
		const anchor = makeAnchor();
		const list = items();
		const onclose = vi.fn();
		render(ContextMenu, { props: { open: true, anchor, label: 'Actions', items: list, onclose } });

		await fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
		expect(list[2]?.onselect).toHaveBeenCalledOnce();
		expect(onclose).toHaveBeenCalledOnce();
		expect(anchor).toHaveFocus();
	});

	it('opens at a point for long-press', () => {
		render(ContextMenu, {
			props: { open: true, anchor: { x: 10, y: 20 }, label: 'Actions', items: items() }
		});
		expect(screen.getByRole('menu')).toBeInTheDocument();
	});
});

describe('ListItem', () => {
	it('renders title and subtitle as static content without a handler', () => {
		render(ListItem, { title: 'Inbox', subtitle: '3 unread' });
		expect(screen.getByText('Inbox')).toBeInTheDocument();
		expect(screen.getByText('3 unread')).toBeInTheDocument();
		expect(screen.queryByRole('button')).toBeNull();
		expect(screen.queryByRole('link')).toBeNull();
	});

	it('is a button with onclick, and a disabled one does not fire', async () => {
		const onclick = vi.fn();
		const { rerender } = render(ListItem, { title: 'Starred', onclick });
		await fireEvent.click(screen.getByRole('button', { name: 'Starred' }));
		expect(onclick).toHaveBeenCalledOnce();

		await rerender({ title: 'Starred', onclick, disabled: true });
		expect(screen.getByRole('button')).toBeDisabled();
	});

	it('is a link with href and marks the current page', () => {
		render(ListItem, { title: 'Settings', href: '/settings', current: true });
		const link = screen.getByRole('link', { name: 'Settings' });
		expect(link).toHaveAttribute('href', '/settings');
		expect(link).toHaveAttribute('aria-current', 'page');
	});

	it('drops the href of a disabled link', () => {
		render(ListItem, { title: 'Labels', href: '/labels', disabled: true });
		const link = screen.getByRole('link', { name: 'Labels' });
		expect(link).not.toHaveAttribute('href');
		expect(link).toHaveAttribute('aria-disabled', 'true');
	});
});

describe('Divider', () => {
	it('is a horizontal separator by default', () => {
		render(Divider);
		expect(screen.getByRole('separator').tagName).toBe('HR');
	});

	it('can be vertical', () => {
		render(Divider, { orientation: 'vertical' });
		expect(screen.getByRole('separator')).toHaveAttribute('aria-orientation', 'vertical');
	});
});

describe('SectionHeader', () => {
	it('renders a heading at the given level', () => {
		render(SectionHeader, { title: 'Labels', level: 3 });
		expect(screen.getByRole('heading', { level: 3, name: 'Labels' })).toBeInTheDocument();
	});

	it('renders an optional action', () => {
		const action = createRawSnippet(() => ({ render: () => '<button>Edit</button>' }));
		render(SectionHeader, { title: 'Labels', action });
		expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
	});
});
