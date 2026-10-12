<script lang="ts">
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Button from '#components/ui/Button.svelte';
	import Icon from '#components/ui/Icon.svelte';

	const COPY = {
		trash: 'Conversations in Trash are deleted forever after 30 days.',
		spam: 'Conversations in Spam are deleted forever after 30 days.'
	} as const;
	const EMPTY_NOW = 'Empty now';

	interface Props {
		mailbox: keyof typeof COPY;
		/** Hides "Empty now" when there is nothing to delete. */
		isEmpty?: boolean;
		onempty: () => void;
	}

	let { mailbox, isEmpty = false, onempty }: Props = $props();
</script>

<div class="banner" role="note">
	<Icon icon={Trash2} size="sm" class="banner__icon" />
	<p class="banner__text">{COPY[mailbox]}</p>
	{#if !isEmpty}
		<Button variant="ghost" size="sm" onclick={onempty}>{EMPTY_NOW}</Button>
	{/if}
</div>

<style>
	.banner {
		display: flex;
		align-items: center;
		gap: var(--nm-space-3);
		margin-block-end: var(--nm-space-2);
		padding-block: var(--nm-space-2);
		padding-inline: var(--nm-space-4) var(--nm-space-2);
		border: 1px solid var(--nm-color-border);
		border-radius: var(--nm-radius-lg);
		background: var(--nm-color-surface-1);
		color: var(--nm-color-text-muted);
	}
	.banner :global(.banner__icon) {
		flex: none;
	}
	.banner__text {
		flex: 1;
		margin: 0;
		font-size: var(--nm-text-caption);
	}
</style>
