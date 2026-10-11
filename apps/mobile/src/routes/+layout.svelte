<script lang="ts">
	import '@ionic/core/css/core.css';
	import '#lib/styles/tokens.css';
	import '#lib/styles/typography.css';
	import '#lib/styles/global.css';
	import '#lib/styles/ionic.css';
	import favicon from '#lib/assets/favicon.svg';
	import { setupIonic } from '#lib/ionic.js';
	import { ThemeStore, setThemeStore } from '#lib/stores/theme.svelte.js';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	setupIonic();

	const theme = setThemeStore(new ThemeStore());
	$effect(() => theme.watchSystem());
	$effect(() => theme.apply());
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<ion-app>
	{@render children()}
</ion-app>
