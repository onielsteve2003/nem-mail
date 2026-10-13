import { render } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import TypingText from './TypingText.svelte';

describe('TypingText', () => {
	it('types the text out, gives screen readers all of it, and reports when done', async () => {
		vi.useFakeTimers();
		const ondone = vi.fn();
		const { container } = render(TypingText, { text: 'Hello there', ondone });
		const [full, visible] = container.querySelectorAll('span');
		expect(full?.textContent).toBe('Hello there');
		expect(visible?.textContent).toBe('');
		await vi.advanceTimersByTimeAsync(10);
		expect(visible?.textContent).toBe('Hel');
		await vi.advanceTimersByTimeAsync(100);
		expect(visible?.textContent).toBe('Hello there');
		expect(ondone).toHaveBeenCalledOnce();
		vi.useRealTimers();
	});
});
