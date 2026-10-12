<script lang="ts">
	import Pencil from '@lucide/svelte/icons/pencil';
	import Icon from '#components/ui/Icon.svelte';

	interface Props {
		/** Shows the "Compose" label; false shrinks the button to its icon. */
		extended: boolean;
		onclick: (event: MouseEvent & { currentTarget: HTMLButtonElement }) => void;
	}

	let { extended, onclick }: Props = $props();
</script>

<!-- The wrapper carries the shadow, because clip-path on the button would cut it off. -->
<span class="fab-shadow">
	<button
		type="button"
		class={['fab', !extended && 'fab--collapsed']}
		aria-haspopup="dialog"
		{onclick}
	>
		<Icon icon={Pencil} size="lg" />
		<span class="label">Compose</span>
	</button>
</span>

<style>
	.fab-shadow {
		display: inline-flex;
		filter: drop-shadow(var(--nm-glow-violet));
		pointer-events: auto;
		view-transition-name: nm-fab;
	}
	/*
	 * Shrinking moves and clips the pill (transform + clip-path) instead of
	 * animating its width, so the icon stays put at the right edge.
	 */
	.fab {
		--fab-size: var(--nm-size-control-lg);
		display: inline-flex;
		align-items: center;
		gap: var(--nm-space-3);
		block-size: var(--fab-size);
		padding-inline: calc((var(--fab-size) - var(--nm-size-icon-lg)) / 2) var(--nm-space-6);
		border: 0;
		border-radius: var(--nm-radius-pill);
		background: var(--nm-color-accent);
		color: var(--nm-color-on-accent);
		font: inherit;
		font-size: var(--nm-text-body);
		font-weight: var(--nm-weight-semibold);
		cursor: pointer;
		clip-path: inset(0 round var(--nm-radius-pill));
		transition:
			transform var(--nm-duration-base) var(--nm-ease-standard),
			clip-path var(--nm-duration-base) var(--nm-ease-standard);
	}
	.fab:hover {
		background: var(--nm-color-accent-hover);
	}
	.fab:active {
		background: var(--nm-color-accent-pressed);
	}
	.fab--collapsed {
		transform: translateX(calc(100% - var(--fab-size)));
		clip-path: inset(0 calc(100% - var(--fab-size)) 0 0 round var(--nm-radius-pill));
	}
	.label {
		transition: opacity var(--nm-duration-fast) var(--nm-ease-standard);
	}
	.fab--collapsed .label {
		opacity: 0;
	}
</style>
