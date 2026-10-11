<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import Minus from '@lucide/svelte/icons/minus';
	import type { HTMLInputAttributes } from 'svelte/elements';
	import Icon from './Icon.svelte';

	interface Props extends Omit<HTMLInputAttributes, 'checked' | 'class' | 'type'> {
		label: string;
		checked?: boolean;
		/** Mixed state, e.g. "select all" when only some rows are selected. */
		indeterminate?: boolean;
		class?: string;
	}

	let {
		label,
		checked = $bindable(false),
		indeterminate = $bindable(false),
		class: className,
		...rest
	}: Props = $props();
</script>

<label class={['check', { 'check--disabled': rest.disabled }, className]}>
	<input {...rest} type="checkbox" class="nm-visually-hidden" bind:checked bind:indeterminate />
	<span class="check__box" aria-hidden="true">
		{#if indeterminate}
			<Icon icon={Minus} size="sm" />
		{:else if checked}
			<Icon icon={Check} size="sm" />
		{/if}
	</span>
	<span class="check__label">{label}</span>
</label>

<style>
	.check {
		position: relative;
		display: inline-flex;
		align-items: center;
		gap: var(--nm-space-4);
		min-block-size: var(--nm-size-touch);
		color: var(--nm-color-text);
		font-family: var(--nm-font-body);
		font-size: var(--nm-text-body);
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
	}
	.check--disabled {
		cursor: not-allowed;
		opacity: 0.45;
	}

	.check__box {
		display: inline-grid;
		place-items: center;
		flex-shrink: 0;
		inline-size: var(--nm-size-icon-lg);
		block-size: var(--nm-size-icon-lg);
		border: 2px solid var(--nm-color-text-muted);
		border-radius: var(--nm-radius-xs);
		color: var(--nm-color-on-accent);
		transition:
			background-color var(--nm-duration-fast) var(--nm-ease-standard),
			border-color var(--nm-duration-fast) var(--nm-ease-standard);
	}
	input:checked + .check__box,
	input:indeterminate + .check__box {
		border-color: var(--nm-color-accent);
		background: var(--nm-color-accent);
	}
	input:focus-visible + .check__box {
		outline: 2px solid var(--nm-color-focus);
		outline-offset: 2px;
	}
</style>
