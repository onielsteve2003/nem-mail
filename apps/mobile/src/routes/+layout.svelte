<script lang="ts">
	import '@ionic/core/css/core.css';
	import '#lib/styles/tokens.css';
	import '#lib/styles/typography.css';
	import '#lib/styles/global.css';
	import '#lib/styles/ionic.css';
	import favicon from '#lib/assets/favicon.svg';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import Splash from '#components/layout/Splash.svelte';
	import Toaster from '#components/ui/Toaster.svelte';
	import { config } from '#lib/config.js';
	import { createRepositories, setRepositories } from '#lib/data/provider.js';
	import { setupIonic } from '#lib/ionic.js';
	import { createAppStores, resetOnUserChange, setAppStores } from '#lib/stores/app.svelte.js';
	import { ThemeStore, setThemeStore } from '#lib/stores/theme.svelte.js';
	import { errorMessage } from '#lib/utils/errors.js';
	import { guardRedirect } from '#lib/utils/guard.js';
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

	// Route guard (F1): the splash covers start-up and any redirect, so a guarded page never flashes.
	const session = stores.session;
	const redirect = $derived(
		session.status === 'ready' ? guardRedirect(page.url.pathname, session.isSignedIn) : null
	);
	const isReady = $derived(session.status === 'ready' && redirect === null);
	$effect(() => {
		if (!redirect) return;
		const href =
			redirect === '/onboarding'
				? resolve('/onboarding')
				: resolve('/mail/[mailbox]', { mailbox: 'inbox' });
		void goto(href, { replaceState: true });
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<ion-app>
	{#if isReady}
		{@render children()}
	{:else}
		<Splash
			error={session.status === 'error' ? errorMessage(session.error) : null}
			onretry={() => void session.restore()}
		/>
	{/if}
	<Toaster />
</ion-app>
