<script lang="ts">
	import EmptyState from '#components/ui/EmptyState.svelte';
	// Placeholder until the onboarding carousel (T4.2).
	const TITLE = 'Welcome';
	const MESSAGE = 'Onboarding is on its way.';
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
