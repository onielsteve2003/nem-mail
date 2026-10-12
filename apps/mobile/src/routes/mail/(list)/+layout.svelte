<script lang="ts">
	import { MediaQuery } from 'svelte/reactivity';
	import { afterNavigate, beforeNavigate, goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import AccountSheet from '#components/layout/AccountSheet.svelte';
	import AiOrb from '#components/layout/AiOrb.svelte';
	import Fab from '#components/layout/Fab.svelte';
	import ReadingPane from '#components/layout/ReadingPane.svelte';
	import SearchBar from '#components/layout/SearchBar.svelte';
	import { getSessionStore } from '#lib/stores/session.svelte.js';
	import { getUiStore } from '#lib/stores/ui.svelte.js';
	import { TWO_PANE_QUERY, readingThreadId, withReadingThread } from '#lib/utils/reading-pane.js';
	import { SCROLL_HIDE_INITIAL, nextScrollHide } from '#lib/utils/scroll-hide.js';
	import type { LayoutProps } from './$types';

	// Sheet name the account switcher opens under.
	const ACCOUNT_SHEET = 'account';
	// Sheet names for compose (T7.1) and the AI assistant (M10), which render them.
	const COMPOSE_SHEET = 'compose';
	const ASSISTANT_SHEET = 'assistant';
	// The compose button shows its label only this close to the top of the list.
	const FAB_EXTENDED_TOP = 8;

	let { children }: LayoutProps = $props();

	const session = getSessionStore();
	const ui = getUiStore();
	let scrollHide = $state(SCROLL_HIDE_INITIAL);
	let isAtTop = $state(true);
	let shell = $state<HTMLDivElement>();

	// Two panes at >= 900px: the list plus a reading pane driven by ?thread=.
	const twoPane = new MediaQuery(TWO_PANE_QUERY, false);
	const threadId = $derived(readingThreadId(page.url));
	// Narrowing the window with a thread open shows that thread full screen.
	$effect(() => {
		if (twoPane.current || !threadId) return;
		void goto(resolve('/mail/thread/[threadId]', { threadId }), { replaceState: true });
	});

	function closeThread(): void {
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- the current resolved path with ?thread= removed
		void goto(withReadingThread(page.url, null));
	}

	// Each mailbox and label keeps its own scroll position (the window never scrolls here).
	beforeNavigate(({ from }) => {
		if (from && shell) ui.scroll.save(from.url.pathname, shell.scrollTop);
	});
	afterNavigate(({ to }) => {
		if (!to || !shell) return;
		shell.scrollTop = ui.scroll.get(to.url.pathname);
		scrollHide = SCROLL_HIDE_INITIAL;
		isAtTop = shell.scrollTop <= FAB_EXTENDED_TOP;
	});

	function onscroll(event: Event & { currentTarget: HTMLDivElement }): void {
		const y = event.currentTarget.scrollTop;
		scrollHide = nextScrollHide(scrollHide, y);
		isAtTop = y <= FAB_EXTENDED_TOP;
	}
</script>

<div class="panes">
	<div class="list">
		<!-- List screens scroll inside this shell, under the floating search bar. -->
		<div class="shell" bind:this={shell} {onscroll}>
			<SearchBar
				searchHref={resolve('/search')}
				accountName={session.user?.name ?? ''}
				onmenu={() => ui.openDrawer()}
				onaccount={() => ui.openSheet(ACCOUNT_SHEET)}
				hidden={!scrollHide.isVisible}
			/>
			{@render children()}
		</div>
		<div class="dock">
			<AiOrb onclick={() => ui.openSheet(ASSISTANT_SHEET)} />
			<Fab extended={isAtTop} onclick={() => ui.openSheet(COMPOSE_SHEET)} />
		</div>
	</div>
	{#if twoPane.current}
		<ReadingPane {threadId} onclose={closeThread} />
	{/if}
</div>
<AccountSheet open={ui.isSheetOpen(ACCOUNT_SHEET)} onclose={() => ui.closeSheet(ACCOUNT_SHEET)} />

<style>
	@media (min-width: 900px) {
		.panes {
			display: grid;
			grid-template-columns: minmax(22rem, 26rem) 1fr;
		}
	}
	.list {
		position: relative;
	}
	/* Bottom right of the list column, above the content and below sheets. */
	.dock {
		position: absolute;
		inset-block-end: calc(var(--nm-safe-bottom) + var(--nm-space-4));
		inset-inline-end: max(var(--nm-space-4), var(--nm-safe-right));
		z-index: var(--nm-z-fab);
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: var(--nm-space-3);
		pointer-events: none;
	}
	.shell {
		block-size: var(--nm-viewport-height);
		overflow-y: auto;
		overscroll-behavior-y: contain;
	}
</style>
