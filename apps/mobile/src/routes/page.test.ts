import { APP_NAME, APP_TAGLINE } from '@nem/shared';
import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import Page from './+page.svelte';

describe('home page', () => {
	it('shows the app name and tagline', () => {
		render(Page);

		expect(screen.getByRole('heading', { level: 1, name: APP_NAME })).toBeInTheDocument();
		expect(screen.getByText(APP_TAGLINE, { exact: false })).toBeInTheDocument();
	});
});
