<script lang="ts">
	import { APP_NAME, APP_TAGLINE } from '@nem/shared';

	const REPO_URL = 'https://github.com/onielsteve2003/nem-mail';
	const REPO_LABEL = 'View on GitHub';
</script>

<svelte:head>
	<title>{APP_NAME}</title>
</svelte:head>

<main>
	<h1>{APP_NAME}</h1>
	<p>{APP_TAGLINE} Coming soon.</p>
	<ion-button href={REPO_URL} target="_blank" rel="noopener noreferrer">{REPO_LABEL}</ion-button>
</main>

<style>
	main {
		min-height: 100dvh;
		display: grid;
		place-content: center;
		text-align: center;
		justify-items: center;
		gap: var(--nm-space-3);
		padding-inline: var(--nm-space-5);
		background: var(--nm-color-bg);
		color: var(--nm-color-text);
		font-family: system-ui, sans-serif;
	}

	h1 {
		margin: 0;
		font-size: 2.5rem;
		background: var(--nm-gradient-aurora);
		background-clip: text;
		color: transparent;
	}

	p {
		margin: 0;
		color: var(--nm-color-text-muted);
	}
</style>
