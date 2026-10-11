<script lang="ts">
	import WifiOff from '@lucide/svelte/icons/wifi-off';
	import { online } from 'svelte/reactivity/window';
	import { collapse } from '#lib/motion/index.js';
	import Icon from './Icon.svelte';

	interface Props {
		message?: string;
		class?: string;
	}

	let { message = "You're offline. Showing saved mail.", class: className }: Props = $props();

	// navigator.onLine can be undefined in odd environments; treat that as online.
	const isOffline = $derived(online.current === false);
</script>

<!-- The live region stays mounted so going offline is announced. -->
<div role="status" class={className}>
	{#if isOffline}
		<div class="banner" transition:collapse>
			<Icon icon={WifiOff} size="sm" />
			<span>{message}</span>
		</div>
	{/if}
</div>

<style>
	.banner {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--nm-space-2);
		padding-block: var(--nm-space-2);
		padding-inline: var(--nm-space-4);
		background: var(--nm-color-surface-3);
		border-block-end: 1px solid var(--nm-color-border);
		color: var(--nm-color-warning);
		font-size: var(--nm-text-label);
		font-weight: var(--nm-weight-medium);
	}
</style>
