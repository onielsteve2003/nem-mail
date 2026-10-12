import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import SearchBar from './SearchBar.svelte';

const props = () => ({
	searchHref: '/search',
	accountName: 'Alex Rivera',
	onmenu: vi.fn(),
	onaccount: vi.fn()
});

describe('SearchBar', () => {
	it('opens the menu, search and account', async () => {
		const p = props();
		render(SearchBar, p);

		await fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Account: Alex Rivera' }));
		expect(p.onmenu).toHaveBeenCalledOnce();
		expect(p.onaccount).toHaveBeenCalledOnce();
		expect(screen.getByRole('link', { name: 'Search in mail' })).toHaveAttribute('href', '/search');
	});

	it('marks itself hidden while scrolling down', async () => {
		const p = props();
		const { rerender } = render(SearchBar, p);
		expect(screen.getByRole('banner')).not.toHaveClass('bar--hidden');

		await rerender({ ...p, hidden: true });
		expect(screen.getByRole('banner')).toHaveClass('bar--hidden');
	});
});
