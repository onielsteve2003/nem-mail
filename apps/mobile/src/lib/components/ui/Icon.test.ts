import Mail from '@lucide/svelte/icons/mail';
import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import Icon from './Icon.svelte';

describe('Icon', () => {
	it('is hidden from assistive tech when it has no label', () => {
		const { container } = render(Icon, { icon: Mail });
		const svg = container.querySelector('svg');

		expect(svg).toHaveAttribute('aria-hidden', 'true');
		expect(svg).toHaveClass('nm-icon', 'nm-icon--md');
	});

	it('is an image with an accessible name when labelled', () => {
		render(Icon, { icon: Mail, label: 'Unread mail', size: 'lg' });
		const svg = screen.getByRole('img', { name: 'Unread mail' });

		expect(svg).not.toHaveAttribute('aria-hidden');
		expect(svg).toHaveClass('nm-icon--lg');
	});

	it('stays decorative when the flag is set, even with a label', () => {
		const { container } = render(Icon, { icon: Mail, label: 'Mail', decorative: true });

		expect(screen.queryByRole('img')).toBeNull();
		expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
	});
});
