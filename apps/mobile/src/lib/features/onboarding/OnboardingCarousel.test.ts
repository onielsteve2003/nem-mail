import { fireEvent, render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import OnboardingCarousel from './OnboardingCarousel.svelte';
import { ONBOARDING_SLIDES } from './slides.js';

beforeEach(() => {
	// jsdom does not scroll; the carousel only needs the call to exist.
	Element.prototype.scrollTo = vi.fn();
});

describe('OnboardingCarousel', () => {
	it('shows three slides and steps through them with Next', async () => {
		render(OnboardingCarousel, { onstart: vi.fn() });
		expect(screen.getAllByRole('group')).toHaveLength(ONBOARDING_SLIDES.length);
		expect(screen.getByRole('button', { name: /^Slide 1/ })).toHaveAttribute(
			'aria-current',
			'step'
		);

		await fireEvent.click(screen.getByRole('button', { name: 'Next' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Next' }));
		expect(screen.getByRole('button', { name: /^Slide 3/ })).toHaveAttribute(
			'aria-current',
			'step'
		);
		expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
	});

	it('starts the demo from any slide and shows sign-in errors', async () => {
		const onstart = vi.fn();
		const { rerender } = render(OnboardingCarousel, { onstart });
		await fireEvent.click(screen.getByRole('button', { name: 'Try the demo' }));
		expect(onstart).toHaveBeenCalledOnce();

		await rerender({ onstart, error: 'Network is down.' });
		expect(screen.getByRole('alert')).toHaveTextContent('Network is down.');
	});
});
