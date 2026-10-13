<script lang="ts">
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import type { Snippet } from 'svelte';
	import { afterNavigate, goto } from '$app/navigation';
	import IconButton from '#components/ui/IconButton.svelte';

	const BACK = 'Back';

	interface Props {
		title: string;
		/** Where back goes after a deep link (no in-app history); already resolved. */
		fallbackHref: string;
		children: Snippet;
	}

	let { title, fallbackHref, children }: Props = $props();

	// Opened from inside the app: back returns there. A deep link goes to the fallback.
	let cameFromApp = false;
	afterNavigate(({ from }) => {
		cameFromApp = !!from;
	});

	function back(): void {
		if (cameFromApp) history.back();
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- callers pass a resolved href
		else void goto(fallbackHref, { replaceState: true });
	}
</script>

<svelte:head>
	<title>{title} · Nem Mail</title>
</svelte:head>

<main class="screen">
	<header class="screen__head">
		<IconButton icon={ArrowLeft} label={BACK} onclick={back} />
		<h1 class="screen__title nm-text-title-2">{title}</h1>
	</header>
	{@render children()}
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
