<script lang="ts">
	import { afterNavigate, goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import EmptyState from '#components/ui/EmptyState.svelte';
	import SearchScreen from '#features/search/SearchScreen.svelte';
	import { searchUrl } from '#features/search/search-url.js';
	import { getRepositories } from '#lib/data/provider.js';
	import { getMailboxStore } from '#lib/stores/mailbox.svelte.js';
	import { getSessionStore } from '#lib/stores/session.svelte.js';

	const TITLE = 'Search';
	// Results list arrives with T9.5.
	const RESULTS_TITLE = 'Results will show here';

	const repos = getRepositories();
	const session = getSessionStore();
	const mailbox = getMailboxStore();

	const query = $derived(page.url.searchParams.get('q')?.trim() ?? '');
	const threads = $derived(Object.values(mailbox.lists).flatMap((list) => list.items));

	// Opened from inside the app: back returns there. A deep link has nowhere to go back to.
	let cameFromApp = false;
	afterNavigate(({ from }) => {
		if (from && from.url.pathname !== page.url.pathname) cameFromApp = true;
	});

	function back(): void {
		if (cameFromApp) history.back();
		else void goto(resolve('/mail/(list)/[mailbox]', { mailbox: 'inbox' }), { replaceState: true });
	}

	function submit(q: string): void {
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- the current resolved /search path with ?q= swapped
		void goto(searchUrl(page.url, q), { replaceState: true });
	}
</script>

<svelte:head>
	<title>{query ? `${query} · ${TITLE}` : TITLE} · Nem Mail</title>
</svelte:head>

<main class="screen">
	{#if session.user}
		<SearchScreen
			{query}
			userId={session.user.id}
			{threads}
			searchContacts={(q) => repos.contacts.search({ q })}
			onsubmit={submit}
			onback={back}
		>
			{#snippet results(q)}
				<EmptyState title={RESULTS_TITLE} message={q} illustration="search" />
			{/snippet}
		</SearchScreen>
	{/if}
</main>

<style>
	.screen {
		min-block-size: var(--nm-viewport-height);
		padding-block-end: var(--nm-safe-bottom);
	}
</style>
