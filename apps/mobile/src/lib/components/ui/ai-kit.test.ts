import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import { MODELS } from '#lib/ai/registry.js';
import AiOrb from '../layout/AiOrb.svelte';
import AIBadge from './AIBadge.svelte';
import AICard from './AICard.svelte';
import ModelManager from './ModelManager.svelte';

const insight = {
	value: true,
	confidence: 0.92,
	explanation: 'Urgent wording and a mismatched link.',
	source: 'model'
} as const;

describe('AI UI kit', () => {
	it('AIBadge explains an insight: why, how sure, and the source', async () => {
		render(AIBadge, { insight });
		await fireEvent.click(screen.getByRole('button', { name: /AI/ }));
		expect(screen.getByText(insight.explanation)).toBeInTheDocument();
		expect(screen.getByText(/92% confident · On-device model/)).toBeInTheDocument();
	});

	it('AICard shows thinking, then an error with Retry', async () => {
		const onretry = vi.fn();
		const { rerender } = render(AICard, { title: 'Summary', isLoading: true });
		expect(screen.getByRole('status')).toHaveTextContent('Thinking…');
		expect(screen.getByRole('region', { name: 'Summary' })).toHaveAttribute('aria-busy', 'true');

		await rerender({ isLoading: false, error: 'Could not summarize.', onretry });
		expect(screen.getByRole('alert')).toHaveTextContent('Could not summarize.');
		await fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
		expect(onretry).toHaveBeenCalledOnce();
	});

	it('AiOrb marks itself busy while thinking', () => {
		render(AiOrb, { onclick: () => {}, isThinking: true });
		expect(screen.getByRole('button', { name: 'AI assistant' })).toHaveAttribute(
			'aria-busy',
			'true'
		);
	});

	it('ModelManager shows each state with its action', async () => {
		const ondownload = vi.fn();
		const onremove = vi.fn();
		const [minilm, sst2, mnli] = MODELS;
		render(ModelManager, {
			models: MODELS,
			backend: 'wasm',
			ondownload,
			onremove,
			states: {
				[minilm!.id]: { status: 'absent', progress: 0, error: null },
				[sst2!.id]: { status: 'downloading', progress: 0.4, error: null },
				[mnli!.id]: { status: 'ready', progress: 1, error: null }
			}
		});
		expect(screen.getByText(/WebAssembly/)).toBeInTheDocument();
		await fireEvent.click(screen.getByRole('button', { name: `Download ${minilm!.name}` }));
		expect(ondownload).toHaveBeenCalledWith(minilm!.id);
		expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '40');
		await fireEvent.click(screen.getByRole('button', { name: `Delete ${mnli!.name}` }));
		expect(onremove).toHaveBeenCalledWith(mnli!.id);
	});

	it('ModelManager blocks downloads when the device cannot run models', () => {
		render(ModelManager, {
			models: MODELS.slice(0, 1),
			backend: 'none',
			ondownload: () => {},
			onremove: () => {},
			states: { [MODELS[0]!.id]: { status: 'error', progress: 0, error: 'Download failed.' } }
		});
		expect(screen.getByRole('alert')).toHaveTextContent('Download failed.');
		expect(screen.getByRole('button', { name: /Retry/ })).toBeDisabled();
	});
});
