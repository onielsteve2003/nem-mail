<script lang="ts">
	import Search from '@lucide/svelte/icons/search';
	import X from '@lucide/svelte/icons/x';
	import type { HTMLInputAttributes } from 'svelte/elements';
	import Icon from './Icon.svelte';

	const CLEAR_LABEL = 'Clear search';

	interface Props extends Omit<HTMLInputAttributes, 'value' | 'class' | 'type'> {
		/** Accessible name. Not shown: the search icon and placeholder carry the meaning visually. */
		label: string;
		value?: string;
		/** Called after the clear button empties the field. */
		onclear?: () => void;
		class?: string;
	}

	let {
		label,
		value = $bindable(''),
		placeholder = label,
		onclear,
		class: className,
		...rest
	}: Props = $props();

	let input = $state<HTMLInputElement>();

	function clear() {
		value = '';
		input?.focus();
		onclear?.();
	}
</script>

<div class={['search', { 'search--disabled': rest.disabled }, className]}>
	<Icon icon={Search} />
	<input
		{...rest}
		bind:this={input}
		bind:value
		type="search"
		aria-label={label}
		{placeholder}
		autocomplete="off"
		enterkeyhint="search"
	/>
	{#if value && !rest.disabled}
		<button type="button" class="search__clear" aria-label={CLEAR_LABEL} onclick={clear}>
			<Icon icon={X} />
		</button>
	{/if}
</div>

<style>
	.search {
		display: flex;
		align-items: center;
		gap: var(--nm-space-3);
		min-block-size: var(--nm-size-control-md);
		padding-inline: var(--nm-space-5) var(--nm-space-1);
		border: 1px solid transparent;
		border-radius: var(--nm-radius-pill);
		background: var(--nm-color-surface-2);
		color: var(--nm-color-text-muted);
		font-family: var(--nm-font-body);
	}
	.search:focus-within {
		border-color: var(--nm-color-accent-text);
	}
	.search--disabled {
		opacity: 0.45;
	}

	input {
		flex: 1;
		min-inline-size: 0;
		padding-block: var(--nm-space-4);
		padding-inline-end: var(--nm-space-4);
		border: 0;
		background: none;
		color: var(--nm-color-text);
		/* 16px or more stops iOS Safari zooming in on focus. */
		font: inherit;
		font-size: var(--nm-text-field);
		outline: none;
		appearance: none;
	}
	/* The container shows focus, so the global ring would double up on the bare input. */
	input:focus-visible {
		box-shadow: none;
	}
	input::placeholder {
		color: var(--nm-color-text-subtle);
	}
	/* Our own clear button replaces the browser one. */
	input::-webkit-search-cancel-button {
		appearance: none;
	}

	.search__clear {
		display: inline-grid;
		place-items: center;
		flex-shrink: 0;
		inline-size: var(--nm-size-touch);
		block-size: var(--nm-size-touch);
		padding: 0;
		border: 0;
		border-radius: var(--nm-radius-round);
		background: none;
		color: inherit;
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
	}
	.search__clear:hover {
		color: var(--nm-color-text);
	}
</style>
