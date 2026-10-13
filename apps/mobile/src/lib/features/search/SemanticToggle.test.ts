import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import { searchUrl, semanticUrl } from './search-url.js';
import SemanticToggle from './SemanticToggle.svelte';

describe('semantic search toggle', () => {
	it('offers the model download when semantic mode needs it', async () => {
		const onchange = vi.fn();
		const ondownload = vi.fn();
		const model = { status: 'absent' as const, progress: 0, error: null };
		render(SemanticToggle, { isOn: true, model, onchange, ondownload });
		await fireEvent.click(screen.getByRole('button', { name: 'Download model' }));
		expect(ondownload).toHaveBeenCalledOnce();
		await fireEvent.click(screen.getByRole('button', { name: /Semantic/ }));
		expect(onchange).toHaveBeenCalledWith(false);
	});

	it('keeps semantic mode in the URL across new queries', () => {
		const on = semanticUrl({ href: 'https://x.example/search?q=old' }, true);
		expect(on.searchParams.get('semantic')).toBe('1');
		expect(searchUrl(on, 'trip').search).toBe('?q=trip&semantic=1');
		expect(semanticUrl(on, false).search).toBe('?q=old');
	});
});
