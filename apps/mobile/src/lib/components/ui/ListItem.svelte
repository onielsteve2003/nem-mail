<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		subtitle?: string;
		/** Icon or avatar before the text. */
		leading?: Snippet;
		/** Meta, badge, toggle or chevron after the text. */
		trailing?: Snippet;
		/** Makes the row a link. */
		href?: string;
		/** Makes the row a button (ignored when href is set). */
		onclick?: (event: MouseEvent) => void;
		disabled?: boolean;
		/** Marks the current page in navigation lists (drawer, settings). */
		current?: boolean;
		class?: string;
	}

	let {
		title,
		subtitle,
		leading,
		trailing,
		href,
		onclick,
		disabled = false,
		current = false,
		class: className
	}: Props = $props();

	const classes = $derived([
		'list-item',
		{
			'list-item--interactive': href !== undefined || onclick !== undefined,
			'list-item--two-line': subtitle !== undefined,
			'list-item--current': current,
			'list-item--disabled': disabled
		},
		className
	]);

	function handleClick(event: MouseEvent) {
		if (disabled) {
			event.preventDefault();
			return;
		}
		onclick?.(event);
	}
</script>

{#snippet content()}
	{#if leading}<span class="list-item__leading">{@render leading()}</span>{/if}
	<span class="list-item__text">
		<span class="list-item__title">{title}</span>
		{#if subtitle}<span class="list-item__subtitle">{subtitle}</span>{/if}
	</span>
	{#if trailing}<span class="list-item__trailing">{@render trailing()}</span>{/if}
{/snippet}

{#if href !== undefined}
	<!-- A disabled link has no href, so it cannot be followed or focused by Tab. -->
	<!-- eslint-disable svelte/no-navigation-without-resolve -- ListItem only forwards the href; callers pass a resolve()d route. -->
	<a
		class={classes}
		href={disabled ? undefined : href}
		role={disabled ? 'link' : undefined}
		aria-disabled={disabled || undefined}
		aria-current={current ? 'page' : undefined}
		onclick={handleClick}
	>
		{@render content()}
	</a>
	<!-- eslint-enable svelte/no-navigation-without-resolve -->
{:else if onclick}
	<button
		type="button"
		class={classes}
		{disabled}
		aria-current={current || undefined}
		onclick={handleClick}
	>
		{@render content()}
	</button>
{:else}
	<div class={classes}>{@render content()}</div>
{/if}

<style>
	.list-item {
		display: flex;
		align-items: center;
		gap: var(--nm-space-4);
		inline-size: 100%;
		min-block-size: var(--nm-size-control-md);
		padding-block: var(--nm-space-2);
		padding-inline: var(--nm-space-4);
		border: 0;
		border-radius: var(--nm-radius-md);
		background: none;
		color: var(--nm-color-text);
		font: inherit;
		text-align: start;
		text-decoration: none;
		-webkit-tap-highlight-color: transparent;
	}
	.list-item--two-line {
		min-block-size: var(--nm-size-control-lg);
	}
	.list-item--interactive {
		cursor: pointer;
		transition: background-color var(--nm-duration-fast) var(--nm-ease-standard);
	}
	.list-item--interactive:hover:not(.list-item--disabled),
	.list-item--interactive:active:not(.list-item--disabled) {
		background: var(--nm-color-glass);
	}
	.list-item--current {
		background: var(--nm-color-accent-soft);
		color: var(--nm-color-accent-text);
		font-weight: var(--nm-weight-semibold);
	}
	.list-item--disabled {
		color: var(--nm-color-text-subtle);
		cursor: not-allowed;
	}

	.list-item__leading,
	.list-item__trailing {
		display: inline-flex;
		flex-shrink: 0;
		align-items: center;
		gap: var(--nm-space-2);
	}
	.list-item__trailing {
		color: var(--nm-color-text-muted);
		font-size: var(--nm-text-label);
	}
	.list-item__text {
		display: flex;
		flex: 1;
		flex-direction: column;
		min-inline-size: 0;
	}
	.list-item__title,
	.list-item__subtitle {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.list-item__title {
		font-size: var(--nm-text-body-lg);
		line-height: var(--nm-leading-snug);
	}
	.list-item__subtitle {
		color: var(--nm-color-text-muted);
		font-size: var(--nm-text-label);
		line-height: var(--nm-leading-snug);
	}
	.list-item--disabled .list-item__subtitle {
		color: inherit;
	}
</style>
