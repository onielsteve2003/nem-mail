<script lang="ts">
	import type { HTMLTextareaAttributes } from 'svelte/elements';

	interface Props extends Omit<HTMLTextareaAttributes, 'value' | 'class'> {
		label: string;
		value?: string;
		hint?: string;
	}

	let { label, value = $bindable(''), hint, rows = 4, ...rest }: Props = $props();

	const id = $props.id();
</script>

<!-- Multi-line twin of TextField for settings text (signature, auto-reply). -->
<div class="field">
	<label class="field__label" for={id}>{label}</label>
	<textarea {...rest} {id} {rows} bind:value aria-describedby={hint ? `${id}-hint` : undefined}
	></textarea>
	{#if hint}
		<p class="field__hint" id="{id}-hint">{hint}</p>
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
	textarea {
		padding: var(--nm-space-4) var(--nm-space-5);
		border: 1px solid var(--nm-color-border-strong);
		border-radius: var(--nm-radius-md);
		background: var(--nm-color-surface-1);
		color: var(--nm-color-text);
		/* 16px or more stops iOS Safari zooming in on focus. */
		font: inherit;
		font-size: max(1rem, var(--nm-text-body));
		resize: vertical;
		outline: none;
		transition: border-color var(--nm-duration-fast) var(--nm-ease-standard);
	}
	textarea:focus-visible {
		border-color: var(--nm-color-accent-text);
		box-shadow: 0 0 0 1px var(--nm-color-accent-text);
	}
	textarea:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
	.field__hint {
		margin: 0;
		color: var(--nm-color-text-subtle);
		font-size: var(--nm-text-caption);
	}
</style>
