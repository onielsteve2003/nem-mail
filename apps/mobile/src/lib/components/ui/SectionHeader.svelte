<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		/** Heading level, so headers fit the page outline. */
		level?: 2 | 3 | 4 | 5 | 6;
		/** Optional trailing action, e.g. a "See all" or "Edit" button. */
		action?: Snippet;
		id?: string;
		class?: string;
	}

	let { title, level = 2, action, id, class: className }: Props = $props();
</script>

<div class={['section-header', className]}>
	<svelte:element this={`h${level}`} {id} class="section-header__title">{title}</svelte:element>
	{#if action}<div class="section-header__action">{@render action()}</div>{/if}
</div>

<style>
	.section-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--nm-space-3);
		min-block-size: var(--nm-size-touch);
		padding-inline: var(--nm-space-4);
	}
	.section-header__title {
		margin: 0;
		color: var(--nm-color-text-muted);
		font-family: var(--nm-font-display);
		font-size: var(--nm-text-caption);
		font-weight: var(--nm-weight-semibold);
		letter-spacing: var(--nm-tracking-wide);
		text-transform: uppercase;
	}
	.section-header__action {
		display: inline-flex;
		flex-shrink: 0;
	}
</style>
