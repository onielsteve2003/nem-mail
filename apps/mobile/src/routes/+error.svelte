<script lang="ts">
	import House from '@lucide/svelte/icons/house';
	import RotateCw from '@lucide/svelte/icons/rotate-cw';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import Button from '#components/ui/Button.svelte';
	import EmptyState from '#components/ui/EmptyState.svelte';
	import Icon from '#components/ui/Icon.svelte';
	import { errorPageCopy } from '#lib/utils/errors.js';

	const isNotFound = $derived(page.status === 404);
	const copy = $derived(errorPageCopy(page.status));
	const inboxHref = resolve('/mail/(list)/[mailbox]', { mailbox: 'inbox' });
</script>

<svelte:head>
	<title>{copy.title} · Nem Mail</title>
</svelte:head>

<main class="screen">
	<EmptyState
		title={copy.title}
		message={copy.message}
		illustration={isNotFound ? 'search' : 'error'}
	>
		{#snippet action()}
			<div class="actions">
				<Button href={inboxHref}>
					{#snippet leading()}<Icon icon={House} />{/snippet}
					Go to Inbox
				</Button>
				{#if !isNotFound}
					<Button variant="glass" onclick={() => location.reload()}>
						{#snippet leading()}<Icon icon={RotateCw} />{/snippet}
						Try again
					</Button>
				{/if}
			</div>
		{/snippet}
	</EmptyState>
</main>

<style>
	.screen {
		display: grid;
		place-items: center;
		min-block-size: var(--nm-viewport-height);
		padding-block: var(--nm-safe-top) var(--nm-safe-bottom);
		padding-inline: var(--nm-safe-left) var(--nm-safe-right);
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: var(--nm-space-3);
	}
</style>
