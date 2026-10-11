<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import X from '@lucide/svelte/icons/x';
	import type { Snippet } from 'svelte';
	import Icon from './Icon.svelte';

	const REMOVE_LABEL = 'Remove';

	interface Props {
		/** Toggle state for filter chips. Shows a check, so it never relies on color alone. */
		selected?: boolean;
		/** Makes the chip pressable (a toggle when `selected` is set). */
		onclick?: (event: MouseEvent) => void;
		/** Adds a remove (×) button, as on recipient chips. */
		onremove?: () => void;
		/** Accessible name of the remove button, e.g. "Remove ada@example.com". */
		removeLabel?: string;
		disabled?: boolean;
		leading?: Snippet;
		children: Snippet;
		class?: string;
	}

	let {
		selected,
		onclick,
		onremove,
		removeLabel = REMOVE_LABEL,
		disabled = false,
		leading,
		children,
		class: className
	}: Props = $props();

	// Synthetic clicks can still reach a disabled button, so guard here too (as Button does).
	function handleClick(event: MouseEvent) {
		if (!disabled) onclick?.(event);
	}
	function handleRemove() {
		if (!disabled) onremove?.();
	}
</script>

{#snippet content()}
	{#if selected}
		<Icon icon={Check} size="sm" />
	{:else}
		{@render leading?.()}
	{/if}
	<span class="chip__text">{@render children()}</span>
{/snippet}

<span
	class={[
		'chip',
		{
			'chip--selected': selected,
			'chip--disabled': disabled,
			'chip--removable': onremove !== undefined
		},
		className
	]}
>
	{#if onclick}
		<button
			type="button"
			class="chip__main chip__hit"
			aria-pressed={selected}
			{disabled}
			onclick={handleClick}
		>
			{@render content()}
		</button>
	{:else}
		<span class="chip__main">{@render content()}</span>
	{/if}
	{#if onremove}
		<button
			type="button"
			class="chip__remove chip__hit"
			aria-label={removeLabel}
			{disabled}
			onclick={handleRemove}
		>
			<Icon icon={X} size="sm" />
		</button>
	{/if}
</span>

<style>
	.chip {
		display: inline-flex;
		align-items: center;
		max-inline-size: 100%;
		block-size: var(--nm-space-8);
		border: 1px solid var(--nm-color-border-strong);
		border-radius: var(--nm-radius-pill);
		background: var(--nm-color-surface-2);
		color: var(--nm-color-text);
		font-family: var(--nm-font-body);
		font-size: var(--nm-text-label);
		font-weight: var(--nm-weight-medium);
		line-height: var(--nm-leading-tight);
		transition:
			background-color var(--nm-duration-fast) var(--nm-ease-standard),
			border-color var(--nm-duration-fast) var(--nm-ease-standard);
	}
	.chip--selected {
		border-color: transparent;
		background: var(--nm-color-accent-soft);
		color: var(--nm-color-accent-text);
	}
	.chip--disabled {
		opacity: 0.45;
	}

	.chip__main {
		display: inline-flex;
		align-items: center;
		gap: var(--nm-space-2);
		min-inline-size: 0;
		block-size: 100%;
		padding-inline: var(--nm-space-4);
		border: 0;
		border-radius: inherit;
		background: none;
		color: inherit;
		font: inherit;
	}
	.chip--removable .chip__main {
		padding-inline-end: var(--nm-space-1);
	}
	.chip__text {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	button {
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
	}
	button:disabled {
		cursor: not-allowed;
	}
	button.chip__main:hover:not(:disabled) {
		background: var(--nm-color-accent-soft);
	}

	.chip__remove {
		display: inline-grid;
		place-items: center;
		inline-size: var(--nm-space-8);
		block-size: 100%;
		padding: 0;
		border: 0;
		border-radius: var(--nm-radius-round);
		background: none;
		color: var(--nm-color-text-muted);
	}
	.chip__remove:hover:not(:disabled) {
		color: var(--nm-color-text);
	}

	/* The chip is 32px tall; stretch the hit area to the 44px touch target. */
	.chip__hit {
		position: relative;
	}
	.chip__hit::after {
		content: '';
		position: absolute;
		inset-block: calc((var(--nm-size-touch) - var(--nm-space-8)) / -2);
		inset-inline: 0;
	}
</style>
