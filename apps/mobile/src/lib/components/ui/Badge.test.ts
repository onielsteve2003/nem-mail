import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import Badge from './Badge.svelte';

describe('Badge', () => {
	it('shows a count in the accent tone', () => {
		const { container } = render(Badge, { count: 7 });
		const badge = container.querySelector('.badge');

		expect(badge).toHaveClass('badge--accent');
		expect(badge).toHaveTextContent('7');
	});

	it('caps the count at max', () => {
		const { container } = render(Badge, { count: 1200, max: 999 });

		expect(container.querySelector('.badge')).toHaveTextContent('999+');
	});

	it('hides a zero count', () => {
		const { container } = render(Badge, { count: 0 });

		expect(container.querySelector('.badge')).toBeNull();
	});

	it('renders a dot when there is no count', () => {
		const { container } = render(Badge, { tone: 'danger' });

		expect(container.querySelector('.badge')).toHaveClass('badge--dot', 'badge--danger');
	});

	it('replaces the bare number with a screen-reader label', () => {
		const { container } = render(Badge, { count: 12, label: '12 unread' });

		expect(container.querySelector('[aria-hidden="true"]')).toHaveTextContent('12');
		expect(container.querySelector('.nm-visually-hidden')).toHaveTextContent('12 unread');
	});
});
