<script lang="ts">
	import { afterNavigate, goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import ThreadView from '#features/thread/ThreadView.svelte';
	import type { PageProps } from './$types';

	const TITLE = 'Conversation';

	let { params }: PageProps = $props();

	// Opened from inside the app: back returns there. A deep link has nowhere to go back to.
	let cameFromApp = false;
	afterNavigate(({ from }) => {
		cameFromApp = !!from;
	});

	function close(): void {
		if (cameFromApp) history.back();
		else void goto(resolve('/mail/(list)/[mailbox]', { mailbox: 'inbox' }), { replaceState: true });
	}
</script>

<svelte:head>
	<title>{TITLE} · Nem Mail</title>
</svelte:head>

<main class="screen">
	<ThreadView threadId={params.threadId} onclose={close} />
</main>

<style>
	.screen {
		min-block-size: var(--nm-viewport-height);
		padding-block: var(--nm-safe-top) var(--nm-safe-bottom);
		padding-inline: var(--nm-safe-left) var(--nm-safe-right);
	}
</style>
