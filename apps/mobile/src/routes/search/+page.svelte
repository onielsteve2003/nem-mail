<script lang="ts">
	import EmptyState from '#components/ui/EmptyState.svelte';
	// Placeholder until the search screen (M9).
	const TITLE = 'Search';
	const MESSAGE = 'Search your mail here soon.';
</script>

<svelte:head>
	<title>{TITLE} · Nem Mail</title>
</svelte:head>

<main class="screen">
	<EmptyState title={TITLE} message={MESSAGE} />
</main>

<style>
	.screen {
		min-block-size: var(--nm-viewport-height);
		padding-block: var(--nm-safe-top) var(--nm-safe-bottom);
		padding-inline: var(--nm-safe-left) var(--nm-safe-right);
	}
</style>
