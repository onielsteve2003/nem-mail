<script lang="ts" module>
	export type IconSize = 'sm' | 'md' | 'lg' | 'xl';
</script>

<script lang="ts">
	import type { LucideIcon } from '@lucide/svelte';

	interface Props {
		/** A Lucide icon. Import it by path (`@lucide/svelte/icons/mail`): the barrel makes dev and tests compile every icon. */
		icon: LucideIcon;
		size?: IconSize;
		/** Accessible name. Required when the icon carries meaning on its own. */
		label?: string;
		/** Hide from assistive tech. Defaults to true when there is no label. */
		decorative?: boolean;
		class?: string;
	}

	let {
		icon: IconComponent,
		size = 'md',
		label,
		decorative = label === undefined,
		class: className
	}: Props = $props();
</script>

{#if decorative}
	<IconComponent class={['nm-icon', `nm-icon--${size}`, className]} aria-hidden="true" />
{:else}
	<IconComponent class={['nm-icon', `nm-icon--${size}`, className]} role="img" aria-label={label} />
{/if}

<style>
	/* CSS beats the width/height attributes Lucide sets, so sizes follow the rem tokens. */
	:global(.nm-icon) {
		flex-shrink: 0;
		color: inherit;
	}
	:global(.nm-icon--sm) {
		inline-size: var(--nm-size-icon-sm);
		block-size: var(--nm-size-icon-sm);
	}
	:global(.nm-icon--md) {
		inline-size: var(--nm-size-icon-md);
		block-size: var(--nm-size-icon-md);
	}
	:global(.nm-icon--lg) {
		inline-size: var(--nm-size-icon-lg);
		block-size: var(--nm-size-icon-lg);
	}
	:global(.nm-icon--xl) {
		inline-size: var(--nm-size-icon-xl);
		block-size: var(--nm-size-icon-xl);
	}
</style>
