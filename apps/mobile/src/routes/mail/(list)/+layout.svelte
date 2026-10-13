<script lang="ts">
	import { MediaQuery } from 'svelte/reactivity';
	import { afterNavigate, beforeNavigate, goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import AccountSheet from '#components/layout/AccountSheet.svelte';
	import AiOrb from '#components/layout/AiOrb.svelte';
	import Fab from '#components/layout/Fab.svelte';
	import ReadingPane from '#components/layout/ReadingPane.svelte';
	import AssistantSheet from '#features/ai/AssistantSheet.svelte';
	import SearchBar from '#components/layout/SearchBar.svelte';
	import { ListRefresh, setListRefresh } from '#features/mail-list/refresh.js';
	import ThreadView from '#features/thread/ThreadView.svelte';
	import { getSelectionStore } from '#lib/stores/selection.svelte.js';
	import { getSessionStore } from '#lib/stores/session.svelte.js';
	import { getUiStore } from '#lib/stores/ui.svelte.js';
	import { TWO_PANE_QUERY, readingThreadId, withReadingThread } from '#lib/utils/reading-pane.js';
	import { SCROLL_HIDE_INITIAL, nextScrollHide } from '#lib/utils/scroll-hide.js';
	import type { LayoutProps } from './$types';

	// Sheet name the account switcher opens under.
	const ACCOUNT_SHEET = 'account';
	// Sheet name for the AI assistant (AI-11).
	const ASSISTANT_SHEET = 'assistant';
	const PULL_TEXT = 'Pull to check for new mail';
	// The compose button shows its label only this close to the top of the list.
	const FAB_EXTENDED_TOP = 8;

	let { children }: LayoutProps = $props();

	const session = getSessionStore();
	const ui = getUiStore();
	const selection = getSelectionStore();
	let scrollHide = $state(SCROLL_HIDE_INITIAL);
	let isAssistantThinking = $state(false);
	let isAtTop = $state(true);
	let shell = $state<HTMLDivElement>();

	// Pull to refresh: the visible list registers what a pull reloads.
	const listRefresh = new ListRefresh();
	setListRefresh(listRefresh);

	async function onrefresh(event: CustomEvent): Promise<void> {
		try {
			await listRefresh.run();
		} finally {
			void (event.target as HTMLIonRefresherElement).complete();
		}
	}

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

{#snippet openThread()}
	{#if threadId}
		<ThreadView
			{threadId}
			variant="close"
			onclose={closeThread}
			onnavigate={(id) =>
				// eslint-disable-next-line svelte/no-navigation-without-resolve -- the current resolved path with ?thread= swapped
				void goto(withReadingThread(page.url, id), { replaceState: true })}
		/>
	{/if}
{/snippet}

<div class="panes">
	<div class="list">
		<!-- ion-content only hosts the refresher; the shell is its scroll host, so
		     list screens scroll inside it, under the floating search bar. -->
		<ion-content scroll-y={false}>
			<ion-refresher slot="fixed" onionRefresh={onrefresh}>
				<ion-refresher-content pulling-text={PULL_TEXT}></ion-refresher-content>
			</ion-refresher>
			<div class="shell ion-content-scroll-host" bind:this={shell} {onscroll}>
				<!-- The list shows its selection bar here instead while rows are selected. -->
				{#if !selection.isActive}
					<SearchBar
						searchHref={resolve('/search')}
						accountName={session.user?.name ?? ''}
						onmenu={() => ui.openDrawer()}
						onaccount={() => ui.openSheet(ACCOUNT_SHEET)}
						hidden={!scrollHide.isVisible}
					/>
				{/if}
				{@render children()}
			</div>
		</ion-content>
		<div class="dock">
			<AiOrb onclick={() => ui.openSheet(ASSISTANT_SHEET)} isThinking={isAssistantThinking} />
			<Fab
				extended={isAtTop}
				onclick={(event) =>
					ui.openCompose(
						{ mode: 'new', threadId: null, messageId: null },
						event.currentTarget.getBoundingClientRect()
					)}
			/>
		</div>
	</div>
	{#if twoPane.current}
		<ReadingPane children={threadId ? openThread : undefined} />
	{/if}
</div>
<AccountSheet open={ui.isSheetOpen(ACCOUNT_SHEET)} onclose={() => ui.closeSheet(ACCOUNT_SHEET)} />
<AssistantSheet
	open={ui.isSheetOpen(ASSISTANT_SHEET)}
	onclose={() => ui.closeSheet(ASSISTANT_SHEET)}
	openThreadId={twoPane.current ? threadId : null}
	threadHref={(id) =>
		twoPane.current
			? withReadingThread(page.url, id)
			: resolve('/mail/thread/[threadId]', { threadId: id })}
	onthinking={(value) => (isAssistantThinking = value)}
/>

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
	ion-content {
		--background: transparent;
		block-size: var(--nm-viewport-height);
	}
	.shell {
		block-size: 100%;
		overflow-y: auto;
		overscroll-behavior-y: contain;
	}
</style>
