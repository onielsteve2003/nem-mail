<script lang="ts">
	import type { Snippet } from 'svelte';
	import EmptyState from '#components/ui/EmptyState.svelte';

	interface Props {
		/** The open thread (the layout renders the thread view), or nothing for the empty state. */
		children?: Snippet;
	}

	let { children }: Props = $props();
</script>

<section class="pane" aria-label="Reading pane">
	{#if children}
		{@render children()}
	{:else}
		<EmptyState
			title="No conversation selected"
			message="Pick a conversation from the list to read it here."
		/>
	{/if}
</section>

<style>
	.pane {
		block-size: var(--nm-viewport-height);
		overflow-y: auto;
		overscroll-behavior-y: contain;
		padding-block: var(--nm-safe-top) var(--nm-safe-bottom);
		padding-inline-end: var(--nm-safe-right);
		border-inline-start: 1px solid var(--nm-color-border);
		background: var(--nm-color-surface-1);
	}
</style>
