import { render } from '@testing-library/svelte';
import { createRawSnippet, flushSync } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import MailRows from './MailRows.svelte';

type Item = { id: string };

const row = createRawSnippet<[Item]>((item) => ({ render: () => `<span>${item().id}</span>` }));
const items = (...ids: string[]): Item[] => ids.map((id) => ({ id }));

function setup(initial: Item[]) {
	const props = { items: initial, row, hasMore: false, isLoadingMore: false, onloadmore: () => {} };
	const view = render(MailRows<Item>, props);
	return {
		...view,
		update: (next: Item[]) => {
			view.rerender({ ...props, items: next });
			flushSync();
		}
	};
}

describe('MailRows', () => {
	afterEach(() => vi.restoreAllMocks());

	it('collapses a row that left the list', () => {
		const animate = vi.spyOn(Element.prototype, 'animate');
		const { container, update } = setup(items('a', 'b', 'c'));
		update(items('a', 'c'));
		const leaving = container.querySelector('li[data-id="b"]');
		expect(leaving).not.toBeNull();
		expect(animate.mock.contexts).toContain(leaving);
	});

	it('does not animate rows that stay', () => {
		const animate = vi.spyOn(Element.prototype, 'animate');
		const { update } = setup(items('a', 'b'));
		update(items('b', 'a'));
		expect(animate).not.toHaveBeenCalled();
	});
});
