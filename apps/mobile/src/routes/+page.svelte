<script lang="ts">
	import { APP_NAME, APP_TAGLINE } from '@nem/shared';
	import AuroraBackground from '#components/ui/AuroraBackground.svelte';

	const REPO_URL = 'https://github.com/onielsteve2003/nem-mail';
	const REPO_LABEL = 'View on GitHub';
</script>

<svelte:head>
	<title>{APP_NAME}</title>
</svelte:head>

<AuroraBackground />

<main>
	<h1 class="nm-text-display nm-text-gradient">{APP_NAME}</h1>
	<p class="nm-text-body-lg nm-text-muted">{APP_TAGLINE} Coming soon.</p>
	<ion-button href={REPO_URL} target="_blank" rel="noopener noreferrer">{REPO_LABEL}</ion-button>
</main>

<style>
	main {
		position: relative;
		z-index: var(--nm-z-raised);
		min-height: var(--nm-viewport-height);
		display: grid;
		place-content: center;
		text-align: center;
		justify-items: center;
		gap: var(--nm-space-3);
		padding-block: var(--nm-safe-top) var(--nm-safe-bottom);
		padding-inline: max(var(--nm-space-5), var(--nm-safe-left))
			max(var(--nm-space-5), var(--nm-safe-right));
	}
</style>
