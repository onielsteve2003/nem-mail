<script lang="ts">
	interface Props {
		/** Read to screen readers while the AI works, e.g. "Summarizing". */
		label?: string;
		/** Number of shimmer lines. */
		lines?: number;
		class?: string;
	}

	let { label = 'Thinking…', lines = 3, class: className }: Props = $props();
</script>

<!-- The AI "thinking" state: aurora light sweeping across placeholder lines. -->
<div class={['thinking', className]} role="status" aria-live="polite">
	<span class="nm-visually-hidden">{label}</span>
	{#each { length: lines }, index (index)}
		<span class={['line', { 'line--last': index === lines - 1 && lines > 1 }]} aria-hidden="true"
		></span>
	{/each}
</div>

<style>
	.thinking {
		display: grid;
		gap: var(--nm-space-2);
	}
	.line {
		position: relative;
		display: block;
		overflow: hidden;
		block-size: 0.75em;
		border-radius: var(--nm-radius-xs);
		background: color-mix(in srgb, var(--nm-color-violet) 14%, var(--nm-color-surface-2));
	}
	.line--last {
		inline-size: 60%;
	}
	/* Transform-only sweep; reduced motion stops it (global.css zeroes durations). */
	.line::after {
		content: '';
		position: absolute;
		inset: 0;
		background: var(--nm-gradient-aurora);
		opacity: 0.35;
		transform: translateX(-100%);
		animation: sweep calc(var(--nm-duration-slower) * 3) var(--nm-ease-standard) infinite;
	}
	.line:nth-child(3)::after {
		animation-delay: calc(var(--nm-duration-fast));
	}
	.line:nth-child(4)::after {
		animation-delay: calc(var(--nm-duration-fast) * 2);
	}
	@keyframes sweep {
		to {
			transform: translateX(100%);
		}
	}
</style>
