import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import CategoryTabs from './CategoryTabs.svelte';

describe('CategoryTabs', () => {
	it('marks the active tab, shows new counts and moves with arrow keys', async () => {
		const onchange = vi.fn();
		render(CategoryTabs, { value: 'primary', counts: { primary: 4, social: 3 }, onchange });
		const tabs = screen.getAllByRole('tab');
		expect(tabs).toHaveLength(5);
		expect(tabs[2]).toHaveTextContent('Social');
		expect(tabs[0]).not.toHaveTextContent('4');
		expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
		expect(tabs[2]).toHaveTextContent('3 new');

		await fireEvent.click(tabs[2]!);
		expect(onchange).toHaveBeenLastCalledWith('social');
		await fireEvent.keyDown(screen.getByRole('tablist'), { key: 'ArrowLeft' });
		expect(onchange).toHaveBeenLastCalledWith('forums');
	});
});
