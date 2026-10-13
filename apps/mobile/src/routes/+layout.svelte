<script lang="ts">
	import '@ionic/core/css/core.css';
	import '#lib/styles/tokens.css';
	import '#lib/styles/typography.css';
	import '#lib/styles/global.css';
	import '#lib/styles/ionic.css';
	import favicon from '#lib/assets/favicon.svg';
	import { goto, onNavigate } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import Drawer from '#components/layout/Drawer.svelte';
	import Splash from '#components/layout/Splash.svelte';
	import OfflineBanner from '#components/ui/OfflineBanner.svelte';
	import Toaster from '#components/ui/Toaster.svelte';
	import ComposeSheet from '#features/compose/ComposeSheet.svelte';
	import { config } from '#lib/config.js';
	import { createRepositories, setDataLayer, setRepositories } from '#lib/data/provider.js';
	import { setupIonic } from '#lib/ionic.js';
	import { prefersReducedMotion, slideStack } from '#lib/motion/index.js';
	import { createAppStores, resetOnUserChange, setAppStores } from '#lib/stores/app.svelte.js';
	import { connectMailAI } from '#lib/stores/mail-ai.js';
	import { connectMailAlerts } from '#lib/stores/mail-alerts.js';
	import { ThemeStore, setThemeStore } from '#lib/stores/theme.svelte.js';
	import { exitApp, listenBackButton } from '#lib/utils/back-button.js';
	import { errorMessage } from '#lib/utils/errors.js';
	import { guardRedirect } from '#lib/utils/guard.js';
	import { watchKeyboard } from '#lib/utils/keyboard.js';
	import { backAction, navDirection, type NavDirection } from '#lib/utils/navigation.js';
	import { hideSplashScreen } from '#lib/utils/splash-screen.js';
	import { syncStatusBar } from '#lib/utils/status-bar.js';
	import type { LayoutProps } from './$types';

	// The element the drawer slides over.
	const MAIN_ID = 'main';

	let { children }: LayoutProps = $props();

	setupIonic();

	const theme = setThemeStore(new ThemeStore());
	$effect(() => theme.watchSystem());
	$effect(() => theme.apply());
	// Native app only: status bar icons follow the theme.
	$effect(() => {
		syncStatusBar(theme.resolved).catch((error: unknown) =>
			console.error('Status bar sync failed', error)
		);
	});
	$effect(() => watchKeyboard(document.documentElement));

	// One data layer and one set of stores for the whole app (architecture §8).
	const data = createRepositories(config, { search: location.search });
	setRepositories(data.repos);
	setDataLayer(data);
	const stores = createAppStores(data.repos, data.sync);
	setAppStores(stores);
	void stores.session.restore();

	$effect(() => data.start());
	$effect(() => stores.mailbox.connect());
	$effect(() =>
		connectMailAI({
			mail: data.repos.mail,
			mailbox: stores.mailbox,
			ai: stores.ai,
			user: () => stores.session.user
		})
	);
	$effect(() => resetOnUserChange(stores));
	$effect(() =>
		connectMailAlerts({
			mail: data.repos.mail,
			settings: data.repos.settings,
			onopen: (threadId) => void goto(resolve('/mail/thread/[threadId]', { threadId }))
		})
	);

	// Route guard (F1): the splash covers start-up and any redirect, so a guarded page never flashes.
	const session = stores.session;
	const redirect = $derived(
		session.status === 'ready' ? guardRedirect(page.url.pathname, session.isSignedIn) : null
	);
	const isReady = $derived(session.status === 'ready' && redirect === null);
	// The drawer swipes open only over the list screens (FR-2.3).
	// The native launch screen stays up until the session is restored (or failed to).
	$effect(() => {
		if (session.status !== 'ready' && session.status !== 'error') return;
		hideSplashScreen().catch((error: unknown) => console.error('Splash hide failed', error));
	});
	const isListRoute = $derived(page.route.id?.startsWith('/mail/(list)') ?? false);
	$effect(() => {
		if (!redirect) return;
		const href =
			redirect === '/onboarding'
				? resolve('/onboarding')
				: resolve('/mail/(list)/[mailbox]', { mailbox: 'inbox' });
		void goto(href, { replaceState: true });
	});

	// Page transitions: the View Transitions API where it exists, else a Svelte
	// slide on a keyed wrapper. Both slide the way the navigation goes.
	const hasViewTransitions = typeof document.startViewTransition === 'function';
	let direction = $state<NavDirection>('forward');
	onNavigate((navigation) => {
		direction = navDirection(navigation);
		if (!hasViewTransitions || prefersReducedMotion()) return;
		if (navigation.from?.url.pathname === navigation.to?.url.pathname) return;
		document.documentElement.dataset['navDirection'] = direction;
		return new Promise((ready) => {
			document.startViewTransition(async () => {
				ready();
				await navigation.complete;
			});
		});
	});
	const pageKey = $derived(hasViewTransitions ? null : page.url.pathname);

	// Android back button (native app only).
	const HOME_PATHS = [
		resolve('/onboarding'),
		resolve('/mail/(list)/[mailbox]', { mailbox: 'inbox' })
	];
	function onBack(): void {
		const { ui, selection } = stores;
		const action = backAction({
			hasSheet: ui.activeSheet !== null,
			isDrawerOpen: ui.isDrawerOpen,
			isSelecting: selection.isActive,
			isHome: (HOME_PATHS as string[]).includes(page.url.pathname)
		});
		if (action === 'close-sheet') ui.closeSheet();
		else if (action === 'close-drawer') ui.closeDrawer();
		else if (action === 'clear-selection') selection.clear();
		else if (action === 'navigate-back') history.back();
		else void exitApp();
	}
	$effect(() => listenBackButton(onBack));
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<ion-app>
	{#if isReady}
		{#if session.isSignedIn}
			<Drawer contentId={MAIN_ID} swipe={isListRoute} />
		{/if}
		<div id={MAIN_ID} class="main">
			{#key pageKey}
				<div class="page" in:slideStack={{ direction: direction === 'back' ? -1 : 1 }}>
					{@render children()}
				</div>
			{/key}
		</div>
		{#if session.isSignedIn}
			<!-- Here, not in a page, so compose opens over the list and the thread route alike. -->
			<ComposeSheet />
		{/if}
	{:else}
		<Splash
			error={session.status === 'error' ? errorMessage(session.error) : null}
			onretry={() => void session.restore()}
		/>
	{/if}
	<OfflineBanner class="nm-offline" />
	<Toaster />
</ion-app>

<style>
	/* Over every screen, under sheets and toasts; clears the status bar. */
	:global(.nm-offline) {
		position: fixed;
		inset-block-start: 0;
		inset-inline: 0;
		z-index: var(--nm-z-overlay);
	}
	:global(.nm-offline) > :global(*) {
		padding-block-start: calc(var(--nm-safe-top) + var(--nm-space-2));
	}
	.main,
	.page {
		block-size: 100%;
	}
</style>
