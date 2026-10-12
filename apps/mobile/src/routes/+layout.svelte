<script lang="ts">
	import '@ionic/core/css/core.css';
	import '#lib/styles/tokens.css';
	import '#lib/styles/typography.css';
	import '#lib/styles/global.css';
	import '#lib/styles/ionic.css';
	import favicon from '#lib/assets/favicon.svg';
	import Toaster from '#components/ui/Toaster.svelte';
	import { config } from '#lib/config.js';
	import { createRepositories, setRepositories } from '#lib/data/provider.js';
	import { setupIonic } from '#lib/ionic.js';
	import { createAppStores, resetOnUserChange, setAppStores } from '#lib/stores/app.svelte.js';
	import { ThemeStore, setThemeStore } from '#lib/stores/theme.svelte.js';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	setupIonic();

	const theme = setThemeStore(new ThemeStore());
	$effect(() => theme.watchSystem());
	$effect(() => theme.apply());

	// One data layer and one set of stores for the whole app (architecture §8).
	const data = createRepositories(config, { search: location.search });
	setRepositories(data.repos);
	const stores = createAppStores(data.repos);
	setAppStores(stores);
	void stores.session.restore();

	$effect(() => data.start());
	$effect(() => stores.mailbox.connect());
	$effect(() => resetOnUserChange(stores));
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<ion-app>
	{@render children()}
	<Toaster />
</ion-app>
