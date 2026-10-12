<script lang="ts">
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import Icon from '#components/ui/Icon.svelte';

	interface Props {
		onclick: () => void;
	}

	let { onclick }: Props = $props();
</script>

<!-- Opens the AI assistant sheet (F8, M10). -->
<button type="button" class="orb" aria-label="AI assistant" aria-haspopup="dialog" {onclick}>
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
