<script lang="ts" module>
	export type ButtonVariant = 'primary' | 'ghost' | 'glass' | 'danger';
	export type ButtonSize = 'sm' | 'md' | 'lg';
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';

	type NativeProps = Omit<HTMLButtonAttributes, 'children'> &
		Omit<HTMLAnchorAttributes, 'children' | 'type'>;

	interface Props extends NativeProps {
		variant?: ButtonVariant;
		size?: ButtonSize;
		/** Shows a spinner, keeps the width and blocks presses. */
		loading?: boolean;
		disabled?: boolean;
		/** Renders a link styled as a button. */
		href?: string;
		/** Square button for a single icon. Used by IconButton. */
		iconOnly?: boolean;
		leading?: Snippet;
		trailing?: Snippet;
		children?: Snippet;
	}

	let {
		variant = 'primary',
		size = 'md',
		loading = false,
		disabled = false,
		href,
		iconOnly = false,
		type = 'button',
		leading,
		trailing,
		children,
		class: className,
		onclick,
		...rest
	}: Props = $props();

	const isInert = $derived(disabled || loading);
	// A link has no native disabled state, so presses are blocked here for both elements.
	function handleClick(event: MouseEvent & { currentTarget: EventTarget & HTMLElement }) {
		if (isInert) {
			event.preventDefault();
			return;
		}
		(onclick as ((e: typeof event) => void) | null | undefined)?.(event);
	}

	const classes = $derived([
		'btn',
		`btn--${variant}`,
		`btn--${size}`,
		{ 'btn--icon-only': iconOnly, 'btn--loading': loading },
		className
	]);
</script>

{#snippet content()}
	<span class="btn__content">
		{@render leading?.()}
		{#if children}<span class="btn__label">{@render children()}</span>{/if}
		{@render trailing?.()}
	</span>
	{#if loading}<span class="btn__spinner" aria-hidden="true"></span>{/if}
{/snippet}

{#if href !== undefined}
	<!-- A disabled link has no href, so it cannot be followed or focused by Tab. -->
	<a
		{...rest}
		class={classes}
		href={isInert ? undefined : href}
		role={isInert ? 'link' : undefined}
		aria-disabled={isInert || undefined}
		aria-busy={loading || undefined}
		onclick={handleClick}
	>
		{@render content()}
	</a>
{:else}
	<button
		{...rest}
		class={classes}
		{type}
		disabled={isInert}
		aria-busy={loading || undefined}
		onclick={handleClick}
	>
		{@render content()}
	</button>
{/if}

<style>
	.btn {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-block-size: var(--nm-size-control-md);
		padding-inline: var(--nm-space-6);
		border: 1px solid transparent;
		border-radius: var(--nm-radius-pill);
		font-family: var(--nm-font-body);
		font-size: var(--nm-text-label);
		font-weight: var(--nm-weight-semibold);
		line-height: var(--nm-leading-tight);
		text-decoration: none;
		cursor: pointer;
		user-select: none;
		-webkit-tap-highlight-color: transparent;
		transition:
			transform var(--nm-duration-fast) var(--nm-ease-standard),
			background-color var(--nm-duration-fast) var(--nm-ease-standard),
			border-color var(--nm-duration-fast) var(--nm-ease-standard);
	}
	.btn:active:not(:disabled, [aria-disabled='true']) {
		transform: scale(0.97);
	}
	.btn:disabled,
	.btn[aria-disabled='true'] {
		cursor: not-allowed;
	}
	.btn:disabled:not(.btn--loading),
	.btn[aria-disabled='true']:not(.btn--loading) {
		opacity: 0.45;
	}

	.btn__content {
		display: inline-flex;
		align-items: center;
		gap: var(--nm-space-3);
	}
	.btn--loading .btn__content {
		visibility: hidden;
	}
	.btn__spinner {
		position: absolute;
		inline-size: var(--nm-size-icon-md);
		block-size: var(--nm-size-icon-md);
		border: 2px solid currentColor;
		border-inline-end-color: transparent;
		border-radius: var(--nm-radius-round);
		animation: spin calc(var(--nm-duration-slower) * 1.5) linear infinite;
	}
	@keyframes spin {
		to {
			transform: rotate(1turn);
		}
	}

	/* Sizes */
	.btn--sm {
		min-block-size: var(--nm-size-control-sm);
		padding-inline: var(--nm-space-5);
	}
	.btn--lg {
		min-block-size: var(--nm-size-control-lg);
		padding-inline: var(--nm-space-8);
		font-size: var(--nm-text-body-lg);
	}
	.btn--icon-only {
		padding-inline: 0;
		inline-size: var(--nm-size-control-md);
	}
	.btn--icon-only.btn--sm {
		inline-size: var(--nm-size-control-sm);
	}
	.btn--icon-only.btn--lg {
		inline-size: var(--nm-size-control-lg);
	}

	/* Variants */
	.btn--primary {
		background: var(--nm-color-accent);
		color: var(--nm-color-on-accent);
	}
	.btn--primary:hover:not(:disabled, [aria-disabled='true']) {
		background: var(--nm-color-accent-hover);
	}
	.btn--primary:active:not(:disabled, [aria-disabled='true']) {
		background: var(--nm-color-accent-pressed);
	}
	.btn--ghost {
		background: transparent;
		color: var(--nm-color-accent-text);
	}
	.btn--ghost:hover:not(:disabled, [aria-disabled='true']) {
		background: var(--nm-color-accent-soft);
	}
	.btn--glass {
		background: var(--nm-color-glass);
		border-color: var(--nm-color-border-strong);
		color: var(--nm-color-text);
		backdrop-filter: blur(16px) saturate(1.4);
		-webkit-backdrop-filter: blur(16px) saturate(1.4);
	}
	.btn--glass:hover:not(:disabled, [aria-disabled='true']) {
		border-color: var(--nm-color-accent-text);
	}
	.btn--danger {
		background: var(--nm-color-danger-fill);
		color: var(--nm-color-on-danger);
	}

	/* Keep the pill shape when the global focus ring applies. */
	.btn:focus-visible {
		border-radius: var(--nm-radius-pill);
	}

	@media (prefers-reduced-motion: reduce) {
		.btn:active:not(:disabled, [aria-disabled='true']) {
			transform: none;
		}
		.btn__spinner {
			animation: none;
		}
	}
</style>
