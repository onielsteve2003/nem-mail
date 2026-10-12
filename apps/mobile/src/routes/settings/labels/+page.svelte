<script lang="ts">
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import { afterNavigate, goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import IconButton from '#components/ui/IconButton.svelte';
	import LabelManager from '#features/organize/LabelManager.svelte';

	const TITLE = 'Labels';
	const BACK = 'Back';

	// Opened from inside the app: back returns there. A deep link goes to the Inbox.
	let cameFromApp = false;
	afterNavigate(({ from }) => {
		cameFromApp = !!from;
	});

	function back(): void {
		if (cameFromApp) history.back();
		else void goto(resolve('/mail/(list)/[mailbox]', { mailbox: 'inbox' }), { replaceState: true });
	}
</script>

<svelte:head>
	<title>{TITLE} · Nem Mail</title>
</svelte:head>

<main class="screen">
	<header class="screen__head">
		<IconButton icon={ArrowLeft} label={BACK} onclick={back} />
		<h1 class="screen__title nm-text-title-2">{TITLE}</h1>
	</header>
	<LabelManager />
</main>

<style>
	.screen {
		min-block-size: var(--nm-viewport-height);
		padding-block: var(--nm-safe-top) var(--nm-safe-bottom);
		padding-inline: var(--nm-safe-left) var(--nm-safe-right);
	}
	.screen__head {
		display: flex;
		align-items: center;
		gap: var(--nm-space-2);
		padding: var(--nm-space-2) var(--nm-space-3);
	}
	.screen__title {
		margin: 0;
	}
</style>
