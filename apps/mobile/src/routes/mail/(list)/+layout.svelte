<script lang="ts">
	import { resolve } from '$app/paths';
	import AccountSheet from '#components/layout/AccountSheet.svelte';
	import SearchBar from '#components/layout/SearchBar.svelte';
	import { getSessionStore } from '#lib/stores/session.svelte.js';
	import { getUiStore } from '#lib/stores/ui.svelte.js';
	import { SCROLL_HIDE_INITIAL, nextScrollHide } from '#lib/utils/scroll-hide.js';
	import type { LayoutProps } from './$types';

	// Sheet name the account switcher opens under.
	const ACCOUNT_SHEET = 'account';

	let { children }: LayoutProps = $props();

	const session = getSessionStore();
	const ui = getUiStore();
	let scrollHide = $state(SCROLL_HIDE_INITIAL);

	function onscroll(event: Event & { currentTarget: HTMLDivElement }): void {
		scrollHide = nextScrollHide(scrollHide, event.currentTarget.scrollTop);
	}
</script>

<!-- List screens scroll inside this shell, under the floating search bar. -->
<div class="shell" {onscroll}>
	<SearchBar
		searchHref={resolve('/search')}
		accountName={session.user?.name ?? ''}
		onmenu={() => ui.openDrawer()}
		onaccount={() => ui.openSheet(ACCOUNT_SHEET)}
		hidden={!scrollHide.isVisible}
	/>
	{@render children()}
</div>
<AccountSheet open={ui.isSheetOpen(ACCOUNT_SHEET)} onclose={() => ui.closeSheet(ACCOUNT_SHEET)} />

<style>
	.shell {
		block-size: var(--nm-viewport-height);
		overflow-y: auto;
		overscroll-behavior-y: contain;
	}
</style>
