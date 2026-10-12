<script lang="ts">
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import Download from '@lucide/svelte/icons/download';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import type { AIBackend } from '#lib/ai/backend.js';
	import type { ModelSpec } from '#lib/ai/registry.js';
	import type { ModelState } from '#lib/ai/service.svelte.js';
	import { formatBytes } from '#lib/utils/files.js';
	import Button from './Button.svelte';
	import Icon from './Icon.svelte';
	import ProgressBar from './ProgressBar.svelte';

	const HEADING = 'On-device models';
	const BACKEND_TEXT = {
		unknown: 'Checking this device…',
		webgpu: 'Runs on your GPU (WebGPU)',
		wasm: 'Runs on your CPU (WebAssembly)',
		none: 'This browser cannot run on-device models. Features use rules instead.'
	} as const;
	const READY_TEXT = 'Downloaded';
	const DOWNLOAD_TEXT = 'Download';
	const DELETE_TEXT = 'Delete';
	const RETRY_TEXT = 'Retry';

	interface Props {
		models: readonly ModelSpec[];
		states: Record<string, ModelState>;
		backend: AIBackend | 'unknown';
		ondownload: (id: string) => void;
		onremove: (id: string) => void;
		class?: string;
	}

	let { models, states, backend, ondownload, onremove, class: className }: Props = $props();

	const headingId = $props.id();
	const UNKNOWN: ModelState = { status: 'unknown', progress: 0, error: null };
</script>

<!-- Optional models: what each does, its size and license, and download/delete. -->
<section class={['manager', className]} aria-labelledby={headingId}>
	<h2 id={headingId} class="manager__heading">{HEADING}</h2>
	<p class="manager__backend">{BACKEND_TEXT[backend]}</p>
	<ul class="manager__list">
		{#each models as model (model.id)}
			{@const state = states[model.id] ?? UNKNOWN}
			<li class="model">
				<div class="model__text">
					<span class="model__name">{model.name}</span>
					<span class="model__meta">
						{model.purpose} · about {formatBytes(model.sizeBytes)} · {model.license}
					</span>
				</div>
				{#if state.status === 'downloading'}
					<ProgressBar
						class="model__progress"
						value={state.progress}
						label={`Downloading ${model.name}`}
						showLabel
					/>
				{:else if state.status === 'ready'}
					<span class="model__ready">
						<Icon icon={CircleCheck} size="sm" />
						{READY_TEXT}
					</span>
					<Button
						variant="ghost"
						size="sm"
						aria-label={`${DELETE_TEXT} ${model.name}`}
						onclick={() => onremove(model.id)}
					>
						{#snippet leading()}<Icon icon={Trash2} size="sm" />{/snippet}
						{DELETE_TEXT}
					</Button>
				{:else}
					{#if state.status === 'error'}
						<p class="model__error" role="alert">{state.error}</p>
					{/if}
					<Button
						variant="glass"
						size="sm"
						disabled={backend === 'none' || state.status === 'unknown'}
						aria-label={`${state.status === 'error' ? RETRY_TEXT : DOWNLOAD_TEXT} ${model.name}`}
						onclick={() => ondownload(model.id)}
					>
						{#snippet leading()}<Icon icon={Download} size="sm" />{/snippet}
						{state.status === 'error' ? RETRY_TEXT : DOWNLOAD_TEXT}
					</Button>
				{/if}
			</li>
		{/each}
	</ul>
</section>

<style>
	.manager {
		display: grid;
		gap: var(--nm-space-2);
	}
	.manager__heading {
		margin: 0;
		font-family: var(--nm-font-display);
		font-size: var(--nm-text-label);
		font-weight: var(--nm-weight-semibold);
	}
	.manager__backend {
		margin: 0;
		color: var(--nm-color-text-muted);
		font-size: var(--nm-text-caption);
	}
	.manager__list {
		display: grid;
		gap: var(--nm-space-2);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.model {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--nm-space-2) var(--nm-space-3);
		padding: var(--nm-space-3);
		border: 1px solid var(--nm-color-border);
		border-radius: var(--nm-radius-md);
		background: var(--nm-color-surface-2);
	}
	.model__text {
		display: grid;
		flex: 1 1 12rem;
		gap: var(--nm-space-1);
		min-inline-size: 0;
	}
	.model__name {
		font-weight: var(--nm-weight-semibold);
	}
	.model__meta {
		color: var(--nm-color-text-muted);
		font-size: var(--nm-text-caption);
	}
	.model :global(.model__progress) {
		flex: 1 1 100%;
	}
	.model__ready {
		display: inline-flex;
		align-items: center;
		gap: var(--nm-space-1);
		color: var(--nm-color-text-muted);
		font-size: var(--nm-text-caption);
	}
	.model__error {
		flex: 1 1 100%;
		margin: 0;
		color: var(--nm-color-danger);
		font-size: var(--nm-text-caption);
	}
</style>
