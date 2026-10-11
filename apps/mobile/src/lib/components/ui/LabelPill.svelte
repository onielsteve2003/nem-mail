<script lang="ts">
	import X from '@lucide/svelte/icons/x';
	import type { LabelColor } from '@nem/shared';
	import Icon from './Icon.svelte';

	const REMOVE_LABEL = (name: string) => `Remove label ${name}`;

	interface Props {
		name: string;
		color?: LabelColor;
		/** Adds a remove (×) button, as in the label picker. */
		onremove?: () => void;
		class?: string;
	}

	let { name, color = 'neutral', onremove, class: className }: Props = $props();
</script>

<span class={['pill', `pill--${color}`, className]}>
	<span class="pill__dot" aria-hidden="true"></span>
	<span class="pill__name">{name}</span>
	{#if onremove}
		<button type="button" class="pill__remove" aria-label={REMOVE_LABEL(name)} onclick={onremove}>
			<Icon icon={X} size="sm" />
		</button>
	{/if}
</span>

<style>
	.pill {
		/* The dot uses the bright accent; the text uses the readable shade for the theme. */
		--pill-base: var(--nm-color-text-subtle);
		--pill-text: var(--nm-color-text-muted);
		display: inline-flex;
		align-items: center;
		gap: var(--nm-space-2);
		max-inline-size: 100%;
		padding-block: var(--nm-space-1);
		padding-inline: var(--nm-space-3);
		border-radius: var(--nm-radius-pill);
		background: color-mix(in srgb, var(--pill-base) 14%, transparent);
		color: var(--pill-text);
		font-family: var(--nm-font-body);
		font-size: var(--nm-text-caption);
		font-weight: var(--nm-weight-semibold);
		line-height: var(--nm-leading-snug);
	}
	.pill--violet {
		--pill-base: var(--nm-color-violet);
		--pill-text: var(--nm-color-accent-text);
	}
	.pill--lime {
		--pill-base: var(--nm-color-lime);
		--pill-text: var(--nm-color-lime-text);
	}
	.pill--cyan {
		--pill-base: var(--nm-color-cyan);
		--pill-text: var(--nm-color-cyan-text);
	}
	.pill--coral {
		--pill-base: var(--nm-color-coral);
		--pill-text: var(--nm-color-coral-text);
	}
	.pill--amber {
		--pill-base: var(--nm-color-amber);
		--pill-text: var(--nm-color-amber-text);
	}

	.pill__dot {
		flex-shrink: 0;
		inline-size: var(--nm-space-3);
		block-size: var(--nm-space-3);
		border-radius: var(--nm-radius-round);
		background: var(--pill-base);
	}
	.pill__name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.pill__remove {
		position: relative;
		display: inline-grid;
		place-items: center;
		margin-inline-end: calc(var(--nm-space-2) * -1);
		padding: 0;
		border: 0;
		background: none;
		color: inherit;
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
	}
	/* Grow the hit area to the 44px touch target without growing the pill. */
	.pill__remove::after {
		content: '';
		position: absolute;
		inset: calc((var(--nm-size-touch) - var(--nm-size-icon-sm)) / -2);
	}
</style>
