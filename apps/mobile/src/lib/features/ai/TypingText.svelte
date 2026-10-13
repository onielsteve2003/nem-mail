<script lang="ts">
	import { prefersReducedMotion } from '#lib/motion/presets.js';

	/** Characters revealed per tick; about 300 characters a second. */
	const STEP = 3;
	const TICK_MS = 10;

	interface Props {
		text: string;
		/** Called once the whole text shows. */
		ondone?: () => void;
		class?: string;
	}

	let { text, ondone, class: className }: Props = $props();

	let shown = $state(0);

	// Each new text types from the start; reduced motion shows it at once.
	$effect(() => {
		const length = text.length;
		if (prefersReducedMotion()) {
			shown = length;
			ondone?.();
			return;
		}
		shown = 0;
		const timer = setInterval(() => {
			shown = Math.min(shown + STEP, length);
			if (shown >= length) {
				clearInterval(timer);
				ondone?.();
			}
		}, TICK_MS);
		return () => clearInterval(timer);
	});
</script>

<!-- Screen readers get the whole text once, not a character at a time. -->
<p class={['typing', className]}>
	<span class="nm-visually-hidden">{text}</span>
	<span aria-hidden="true">{text.slice(0, shown)}</span>
</p>

<style>
	.typing {
		margin: 0;
		white-space: pre-wrap;
	}
</style>
