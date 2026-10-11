import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import Avatar from './Avatar.svelte';

describe('Avatar', () => {
	it('shows initials on a gradient named by the person', () => {
		const { container } = render(Avatar, { name: 'Ada Lovelace' });
		const avatar = screen.getByRole('img', { name: 'Ada Lovelace' });

		expect(avatar).toHaveClass('avatar--md');
		expect(avatar).toHaveTextContent('AL');
		expect(avatar.getAttribute('style')).toMatch(/--avatar-from: var\(--nm-color-\w+\)/);
		expect(container.querySelector('img')).toBeNull();
	});

	it('gives the same name the same gradient', () => {
		const { container } = render(Avatar, { name: 'Ada Lovelace' });
		const { container: other } = render(Avatar, { name: 'ada lovelace' });

		expect(container.querySelector('.avatar')?.getAttribute('style')).toBe(
			other.querySelector('.avatar')?.getAttribute('style')
		);
	});

	it('shows the photo and falls back to initials if it fails', async () => {
		const { container } = render(Avatar, { name: 'Ada Lovelace', src: '/ada.png' });
		const img = container.querySelector('img');
		expect(img).toHaveAttribute('src', '/ada.png');
		expect(img).toHaveAttribute('alt', '');

		await fireEvent.error(img as HTMLImageElement);

		expect(container.querySelector('img')).toBeNull();
		expect(screen.getByRole('img', { name: 'Ada Lovelace' })).toHaveTextContent('AL');
	});

	it('flips to the check face when selected', () => {
		const { container } = render(Avatar, { name: 'Ada', selected: true });

		expect(container.querySelector('.avatar__inner')).toHaveClass('avatar__inner--flipped');
	});

	it('becomes a select toggle when given onclick', async () => {
		const onclick = vi.fn();
		render(Avatar, { name: 'Ada Lovelace', onclick });
		const button = screen.getByRole('button', { name: 'Select Ada Lovelace' });

		expect(button).toHaveAttribute('aria-pressed', 'false');
		await fireEvent.click(button);
		expect(onclick).toHaveBeenCalledOnce();
	});

	it('reports the selected state on the toggle', () => {
		render(Avatar, { name: 'Ada', onclick: () => {}, selected: true, label: 'Select thread' });

		expect(screen.getByRole('button', { name: 'Select thread' })).toHaveAttribute(
			'aria-pressed',
			'true'
		);
	});

	it('does not fire while disabled', async () => {
		const onclick = vi.fn();
		render(Avatar, { name: 'Ada', onclick, disabled: true });

		await fireEvent.click(screen.getByRole('button'));

		expect(onclick).not.toHaveBeenCalled();
	});
});
