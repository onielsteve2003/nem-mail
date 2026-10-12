<script lang="ts">
	import EmptyState from '#components/ui/EmptyState.svelte';
	import type { PageProps } from './$types';

	// Placeholder until the thread view (M6).
	const TITLE = 'Conversation';
	const MESSAGE = 'This conversation will open here.';

	let { params }: PageProps = $props();
</script>

<svelte:head>
	<title>{TITLE} · Nem Mail</title>
</svelte:head>

<main class="screen">
	<EmptyState title={TITLE} message={`${MESSAGE} (${params.threadId})`} />
</main>

<style>
	.screen {
		min-block-size: var(--nm-viewport-height);
		padding-block: var(--nm-safe-top) var(--nm-safe-bottom);
		padding-inline: var(--nm-safe-left) var(--nm-safe-right);
	}
</style>
