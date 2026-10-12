<script lang="ts">
	import X from '@lucide/svelte/icons/x';
	import EmptyState from '#components/ui/EmptyState.svelte';
	import IconButton from '#components/ui/IconButton.svelte';

	interface Props {
		/** The thread to show, or null for the empty state. */
		threadId: string | null;
		onclose: () => void;
	}

	let { threadId, onclose }: Props = $props();
</script>

<!-- The thread view (M6) renders here; until then a placeholder names the thread. -->
<section class="pane" aria-label="Reading pane">
	{#if threadId}
		<div class="toolbar">
			<IconButton icon={X} label="Close conversation" variant="ghost" onclick={onclose} />
		</div>
		<EmptyState title="Conversation" message={`This conversation will open here. (${threadId})`} />
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
	.toolbar {
		display: flex;
		justify-content: flex-end;
		padding: var(--nm-space-2);
	}
</style>
