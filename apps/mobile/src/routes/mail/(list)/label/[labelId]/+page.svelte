<script lang="ts">
	import EmptyState from '#components/ui/EmptyState.svelte';
	import type { PageProps } from './$types';

	// Placeholder until label lists (M5).
	const TITLE = 'Label';
	const MESSAGE = 'Conversations with this label will show here.';

	let { params }: PageProps = $props();
</script>

<svelte:head>
	<title>{TITLE} · Nem Mail</title>
</svelte:head>

<main class="screen">
	<EmptyState title={TITLE} message={`${MESSAGE} (${params.labelId})`} />
</main>

<style>
	.screen {
		padding-block-end: var(--nm-safe-bottom);
		padding-inline: var(--nm-safe-left) var(--nm-safe-right);
	}
</style>
