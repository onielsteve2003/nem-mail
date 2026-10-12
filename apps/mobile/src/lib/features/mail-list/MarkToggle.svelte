<script lang="ts">
	import type { LucideIcon } from '@lucide/svelte';
	import Icon from '#components/ui/Icon.svelte';

	// Six sparks around the icon, one every 60 degrees.
	const SPARKS = [0, 60, 120, 180, 240, 300];

	interface Props {
		icon: LucideIcon;
		/** Names the mark, e.g. "Starred"; the button reads as a pressed toggle. */
		label: string;
		pressed: boolean;
		/** Plays a spark burst when the mark turns on. */
		burst?: boolean;
		disabled?: boolean;
		ontoggle: () => void;
	}

	let { icon, label, pressed, burst = false, disabled = false, ontoggle }: Props = $props();

	// Bumped on each turn-on, so the keyed burst replays.
	let bursts = $state(0);

	function onclick(event: MouseEvent): void {
		// The row may be a link or a swipe target; the toggle never opens the thread.
		event.stopPropagation();
		if (burst && !pressed) bursts++;
		ontoggle();
	}
</script>

<button
	type="button"
	class={['mark', { 'mark--on': pressed }]}
	aria-label={label}
	aria-pressed={pressed}
	{disabled}
	{onclick}
>
	{#key bursts}
		<span class={['mark__icon', { 'mark__icon--pop': bursts > 0 }]}>
			<Icon {icon} size="sm" />
		</span>
		{#if bursts > 0}
			<span class="mark__burst" aria-hidden="true">
				{#each SPARKS as angle (angle)}
					<span class="mark__spark" style:--angle="{angle}deg"></span>
				{/each}
			</span>
		{/if}
	{/key}
</button>

<style>
	.mark {
		position: relative;
		display: inline-grid;
		place-items: center;
		inline-size: var(--nm-size-touch);
		block-size: var(--nm-size-touch);
		padding: 0;
		border: 0;
		border-radius: var(--nm-radius-round);
		background: none;
		color: var(--nm-color-text-subtle);
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
	}
	.mark:focus-visible {
		outline: 2px solid var(--nm-color-focus);
		outline-offset: calc(-1 * var(--nm-space-2));
	}
	.mark:disabled {
		cursor: default;
		opacity: 0.5;
	}
	.mark--on {
		color: var(--nm-color-amber);
	}
	.mark--on :global(svg) {
		fill: currentColor;
	}
	.mark__icon {
		display: inline-flex;
	}
	.mark__icon--pop {
		animation: pop var(--nm-duration-slow) var(--nm-ease-spring);
	}
	.mark__burst {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}
	.mark__spark {
		position: absolute;
		inset-block-start: 50%;
		inset-inline-start: 50%;
		inline-size: var(--nm-space-2);
		block-size: var(--nm-space-2);
		margin: calc(-1 * var(--nm-space-1));
		border-radius: var(--nm-radius-round);
		background: var(--nm-color-amber);
		opacity: 0;
		animation: spark var(--nm-duration-slower) var(--nm-ease-decelerate);
	}
	@keyframes pop {
		0% {
			transform: scale(0.6);
		}
		60% {
			transform: scale(1.3);
		}
		100% {
			transform: scale(1);
		}
	}
	@keyframes spark {
		0% {
			opacity: 1;
			transform: rotate(var(--angle)) translateY(0) scale(1);
		}
		100% {
			opacity: 0;
			transform: rotate(var(--angle)) translateY(-1rem) scale(0.4);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.mark__icon--pop,
		.mark__spark {
			animation: none;
		}
	}
</style>
