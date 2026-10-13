<script lang="ts">
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import Icon from '#components/ui/Icon.svelte';

	interface Props {
		onclick: () => void;
		/** Spins an aurora ring while the assistant works. */
		isThinking?: boolean;
	}

	let { onclick, isThinking = false }: Props = $props();
</script>

<!-- Opens the AI assistant sheet (F8, M10). -->
<button
	type="button"
	class={['orb', { 'orb--thinking': isThinking }]}
	aria-label="AI assistant"
	aria-haspopup="dialog"
	aria-busy={isThinking}
	{onclick}
>
	<Icon icon={Sparkles} size="md" />
</button>

<style>
	.orb {
		position: relative;
		display: grid;
		place-items: center;
		inline-size: var(--nm-size-control-md);
		block-size: var(--nm-size-control-md);
		padding: 0;
		border: 0;
		border-radius: var(--nm-radius-round);
		background: var(--nm-gradient-aurora);
		color: var(--nm-color-on-aurora);
		cursor: pointer;
		pointer-events: auto;
		view-transition-name: nm-ai-orb;
		transition: transform var(--nm-duration-fast) var(--nm-ease-spring);
	}
	.orb:active {
		transform: scale(0.92);
	}
	/* A slow breathing glow; still under reduced motion (global.css zeroes durations). */
	.orb::before {
		content: '';
		position: absolute;
		inset: 0;
		z-index: -1;
		border-radius: inherit;
		box-shadow: var(--nm-glow-violet), var(--nm-glow-cyan);
		animation: breathe 3.2s var(--nm-ease-standard) infinite alternate;
	}
	/* Low power: no ambient breathing (the thinking ring below still turns: it means work). */
	:global(:root[data-low-power='true']) .orb::before {
		animation: none;
	}
	/* Thinking: a conic aurora ring turning around the orb (transform only). */
	.orb--thinking::after {
		content: '';
		position: absolute;
		inset: calc(var(--nm-space-1) * -1);
		z-index: -1;
		border-radius: inherit;
		background: conic-gradient(
			var(--nm-color-violet),
			var(--nm-color-cyan),
			var(--nm-color-violet)
		);
		mask: radial-gradient(
			farthest-side,
			transparent calc(100% - 3px),
			currentColor calc(100% - 2px)
		);
		animation: spin calc(var(--nm-duration-slower) * 2) linear infinite;
	}
	@keyframes spin {
		to {
			transform: rotate(1turn);
		}
	}
	@keyframes breathe {
		from {
			opacity: 0.45;
			transform: scale(0.96);
		}
		to {
			opacity: 1;
			transform: scale(1.08);
		}
	}
</style>
