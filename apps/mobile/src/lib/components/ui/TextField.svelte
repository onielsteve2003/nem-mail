<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLInputAttributes } from 'svelte/elements';

	interface Props extends Omit<HTMLInputAttributes, 'value' | 'class'> {
		/** Visible label. Always rendered, so the field never relies on a placeholder. */
		label: string;
		value?: string;
		/** Helper text under the field. Hidden while there is an error. */
		hint?: string;
		/** Error message. Marks the field invalid and is announced with it. */
		error?: string;
		leading?: Snippet;
		trailing?: Snippet;
		class?: string;
	}

	let {
		label,
		value = $bindable(''),
		hint,
		error,
		type = 'text',
		leading,
		trailing,
		class: className,
		...rest
	}: Props = $props();

	const id = $props.id();
	const describedBy = $derived(error ? `${id}-error` : hint ? `${id}-hint` : undefined);
</script>

<div class={['field', { 'field--invalid': error, 'field--disabled': rest.disabled }, className]}>
	<label class="field__label" for={id}>{label}</label>
	<div class="field__control">
		{@render leading?.()}
		<input
			{...rest}
			{id}
			{type}
			bind:value
			aria-invalid={error ? 'true' : undefined}
			aria-describedby={describedBy}
		/>
		{@render trailing?.()}
	</div>
	{#if error}
		<p class="field__message field__message--error" id="{id}-error">{error}</p>
	{:else if hint}
		<p class="field__message" id="{id}-hint">{hint}</p>
	{/if}
</div>

<style>
	.field {
		display: grid;
		gap: var(--nm-space-2);
		font-family: var(--nm-font-body);
	}
	.field__label {
		color: var(--nm-color-text-muted);
		font-size: var(--nm-text-label);
		font-weight: var(--nm-weight-medium);
	}

	.field__control {
		display: flex;
		align-items: center;
		gap: var(--nm-space-3);
		min-block-size: var(--nm-size-control-md);
		padding-inline: var(--nm-space-5);
		border: 1px solid var(--nm-color-border-strong);
		border-radius: var(--nm-radius-md);
		background: var(--nm-color-surface-1);
		color: var(--nm-color-text-muted);
		transition: border-color var(--nm-duration-fast) var(--nm-ease-standard);
	}
	.field__control:focus-within {
		border-color: var(--nm-color-accent-text);
	}
	.field--invalid .field__control {
		border-color: var(--nm-color-danger);
	}
	.field--disabled .field__control {
		opacity: 0.45;
	}

	input {
		flex: 1;
		min-inline-size: 0;
		block-size: 100%;
		padding-block: var(--nm-space-4);
		border: 0;
		background: none;
		color: var(--nm-color-text);
		/* 16px or more stops iOS Safari zooming in on focus. */
		font: inherit;
		font-size: var(--nm-text-field);
		outline: none;
	}
	/* The container shows focus, so the global ring would double up on the bare input. */
	input:focus-visible {
		box-shadow: none;
	}
	input::placeholder {
		color: var(--nm-color-text-subtle);
	}
	input:disabled {
		cursor: not-allowed;
	}

	.field__message {
		margin: 0;
		color: var(--nm-color-text-subtle);
		font-size: var(--nm-text-caption);
	}
	.field__message--error {
		color: var(--nm-color-danger);
	}
</style>
