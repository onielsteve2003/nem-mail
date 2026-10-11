<script lang="ts">
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import type { Snippet } from 'svelte';
	import { fadeScale } from '#lib/motion/index.js';
	import Icon from './Icon.svelte';

	const BADGE_TEXT = 'AI';
	const EXPLAIN_HINT = 'Why am I seeing this?';

	interface Props {
		/** Tap-to-explain content, e.g. "Flagged as spam: 92% confidence". Makes the badge a button. */
		explanation?: Snippet;
		class?: string;
	}

	let { explanation, class: className }: Props = $props();

	const panelId = $props.id();
	let isOpen = $state(false);
	let root = $state<HTMLElement>();
	let trigger = $state<HTMLButtonElement>();

	function close(returnFocus: boolean) {
		isOpen = false;
		if (returnFocus) trigger?.focus();
	}

	function handleKeydown(event: KeyboardEvent) {
		if (isOpen && event.key === 'Escape') {
			event.stopPropagation();
			close(true);
		}
	}

	function handleOutsidePointer(event: PointerEvent) {
		if (isOpen && root && !root.contains(event.target as Node)) close(false);
	}
</script>

<svelte:document onpointerdown={handleOutsidePointer} />

{#snippet face()}
	<Icon icon={Sparkles} size="sm" />
	<span>{BADGE_TEXT}</span>
{/snippet}

{#if explanation}
	<!-- Escape is handled on the wrapper so it also works once focus moves into the panel. -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<span class={['ai-badge-root', className]} bind:this={root} onkeydown={handleKeydown}>
		<button
			bind:this={trigger}
			type="button"
			class="ai-badge ai-badge--button"
			aria-expanded={isOpen}
			aria-controls={panelId}
			onclick={() => (isOpen = !isOpen)}
		>
			{@render face()}
			<span class="nm-visually-hidden">{EXPLAIN_HINT}</span>
		</button>
		{#if isOpen}
			<div id={panelId} class="ai-panel" transition:fadeScale>
				{@render explanation()}
			</div>
		{/if}
	</span>
{:else}
	<span class={['ai-badge', className]}>{@render face()}</span>
{/if}

<style>
	.ai-badge-root {
		position: relative;
		display: inline-flex;
	}
	.ai-badge {
		display: inline-flex;
		align-items: center;
		gap: var(--nm-space-1);
		padding-block: var(--nm-space-1);
		padding-inline: var(--nm-space-2);
		border: 1px solid color-mix(in srgb, var(--nm-color-violet) 45%, transparent);
		border-radius: var(--nm-radius-pill);
		background: var(--nm-color-accent-soft);
		color: var(--nm-color-accent-text);
		font-family: var(--nm-font-display);
		font-size: var(--nm-text-micro);
		font-weight: var(--nm-weight-bold);
		letter-spacing: var(--nm-tracking-wide);
		line-height: 1;
	}
	.ai-badge--button {
		position: relative;
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
	}
	.ai-badge--button[aria-expanded='true'],
	.ai-badge--button:hover {
		box-shadow: var(--nm-glow-violet);
	}
	/* A small badge, but a 44px touch target. */
	.ai-badge--button::after {
		content: '';
		position: absolute;
		inset-block: calc((var(--nm-size-touch) - var(--nm-space-6)) / -2);
		inset-inline: 0;
	}

	.ai-panel {
		position: absolute;
		inset-block-start: calc(100% + var(--nm-space-3));
		inset-inline-start: 0;
		z-index: var(--nm-z-popover);
		inline-size: max-content;
		max-inline-size: min(18rem, 80vw);
		padding: var(--nm-space-4);
		border: 1px solid var(--nm-color-border-strong);
		border-radius: var(--nm-radius-md);
		background: var(--nm-color-surface-3);
		box-shadow: var(--nm-shadow-3);
		color: var(--nm-color-text);
		font-size: var(--nm-text-label);
		line-height: var(--nm-leading-normal);
		transform-origin: top left;
	}
</style>
