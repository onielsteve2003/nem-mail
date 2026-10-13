<script lang="ts">
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import AIBadge from '#components/ui/AIBadge.svelte';
	import Button from '#components/ui/Button.svelte';
	import Chip from '#components/ui/Chip.svelte';
	import Icon from '#components/ui/Icon.svelte';
	import ProgressBar from '#components/ui/ProgressBar.svelte';
	import type { ModelState } from '#lib/ai/service.svelte.js';

	const COPY = {
		label: 'Semantic',
		explain:
			'Ranked by meaning with MiniLM on this device, blended with keyword matches. Your mail never leaves the device.',
		needsModel:
			'Semantic search finds mail by meaning, not just matching words. It needs MiniLM (about 23 MB), downloaded once and kept on this device.',
		download: 'Download model',
		downloading: 'Downloading MiniLM',
		retry: 'Try again'
	};

	interface Props {
		isOn: boolean;
		model: ModelState;
		onchange: (isOn: boolean) => void;
		ondownload: () => void;
	}

	let { isOn, model, onchange, ondownload }: Props = $props();
</script>

<div class="semantic">
	<div class="semantic__row">
		<Chip selected={isOn} onclick={() => onchange(!isOn)}>
			{#snippet leading()}<Icon icon={Sparkles} size="sm" />{/snippet}
			{COPY.label}
		</Chip>
		{#if isOn && model.status === 'ready'}
			<AIBadge>
				{#snippet explanation()}{COPY.explain}{/snippet}
			</AIBadge>
		{/if}
	</div>
	{#if isOn && model.status !== 'ready'}
		<div class="semantic__note" role="status">
			{#if model.status === 'downloading'}
				<ProgressBar value={model.progress} label={COPY.downloading} showLabel />
			{:else}
				<p class="nm-text-caption">{model.error ?? COPY.needsModel}</p>
				<Button
					size="sm"
					variant="glass"
					disabled={model.status === 'unknown'}
					onclick={ondownload}
				>
					{model.status === 'error' ? COPY.retry : COPY.download}
				</Button>
			{/if}
		</div>
	{/if}
</div>

<style>
	.semantic {
		display: flex;
		flex-direction: column;
		gap: var(--nm-space-2);
		padding: var(--nm-space-1) var(--nm-space-4);
	}
	.semantic__row {
		display: flex;
		align-items: center;
		gap: var(--nm-space-2);
	}
	.semantic__note {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--nm-space-2);
		padding: var(--nm-space-3);
		border: 1px solid var(--nm-color-border);
		border-radius: var(--nm-radius-md);
		background: var(--nm-color-surface-1);
	}
	.semantic__note p {
		margin: 0;
		color: var(--nm-color-text-muted);
	}
</style>
