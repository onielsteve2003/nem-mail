<script lang="ts">
	import EmptyState from '#components/ui/EmptyState.svelte';
	import type { PageProps } from './$types';

	// Placeholder until the mail list (M5).
	const MESSAGE = 'Your conversations will show here.';

	let { data }: PageProps = $props();
	const title = $derived(data.mailbox.charAt(0).toUpperCase() + data.mailbox.slice(1));
</script>

<svelte:head>
	<title>{title} · Nem Mail</title>
</svelte:head>

<main class="screen">
	<EmptyState {title} message={MESSAGE} />
</main>

<style>
	.screen {
		min-block-size: var(--nm-viewport-height);
		padding-block: var(--nm-safe-top) var(--nm-safe-bottom);
		padding-inline: var(--nm-safe-left) var(--nm-safe-right);
	}
</style>
