import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import AvatarStack from './AvatarStack.svelte';

const people = (...names: string[]) => names.map((name) => ({ name }));

describe('AvatarStack', () => {
	it('names everyone when all fit', () => {
		const { container } = render(AvatarStack, { people: people('Ada', 'Linus') });

		expect(screen.getByRole('img', { name: 'Ada and Linus' })).toBeInTheDocument();
		expect(container.querySelectorAll('.avatar')).toHaveLength(2);
		expect(container.querySelector('.stack__more')).toBeNull();
	});

	it('collapses the overflow into +N', () => {
		const { container } = render(AvatarStack, {
			people: people('Ada', 'Linus', 'Grace', 'Alan', 'Barbara'),
			max: 3
		});

		expect(screen.getByRole('img', { name: 'Ada, Linus, Grace and 2 others' })).toBeInTheDocument();
		expect(container.querySelectorAll('.avatar')).toHaveLength(3);
		expect(container.querySelector('.stack__more')).toHaveTextContent('+2');
	});

	it('uses the singular for one hidden person', () => {
		render(AvatarStack, { people: people('Ada', 'Linus'), max: 1 });

		expect(screen.getByRole('img', { name: 'Ada and 1 other' })).toBeInTheDocument();
	});

	it('hides the inner avatars from assistive tech', () => {
		render(AvatarStack, { people: people('Ada', 'Linus') });

		expect(screen.getAllByRole('img')).toHaveLength(1);
	});

	it('renders nothing for an empty list', () => {
		const { container } = render(AvatarStack, { people: [] });

		expect(container.querySelector('.stack')).toBeNull();
	});
});
