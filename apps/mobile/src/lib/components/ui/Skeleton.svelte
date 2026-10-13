<script lang="ts">
	interface Props {
		/** text draws `lines` bars; circle suits avatars. */
		shape?: 'text' | 'rect' | 'circle';
		/** Number of text lines; the last one is shorter. */
		lines?: number;
		/** Any CSS length, e.g. var(--nm-size-avatar-md). */
		width?: string;
		height?: string;
		class?: string;
	}

	let { shape = 'text', lines = 1, width, height, class: className }: Props = $props();
</script>

<!-- Decorative: the loading container sets aria-busy and announces the load. -->
{#if shape === 'text'}
	<span class={['stack', className]} style:inline-size={width} aria-hidden="true">
		{#each { length: lines }, index (index)}
			<span class={['bone', 'bone--text', { 'bone--last': lines > 1 && index === lines - 1 }]}
			></span>
		{/each}
	</span>
{:else}
	<span
		class={['bone', `bone--${shape}`, className]}
		style:inline-size={width}
		style:block-size={height ?? width}
		aria-hidden="true"
	></span>
{/if}

<style>
	.stack {
		display: grid;
		gap: var(--nm-space-2);
	}
	.bone {
		position: relative;
		display: block;
		overflow: hidden;
		background: var(--nm-color-surface-3);
	}
	/* The shimmer moves with transform only; under reduced motion it stays put. */
	.bone::after {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(
			90deg,
			transparent,
			color-mix(in srgb, var(--nm-color-text) 8%, transparent),
			transparent
		);
		transform: translateX(-100%);
		animation: shimmer calc(var(--nm-duration-slower) * 3) var(--nm-ease-standard) infinite;
	}
	/* Low power: plain bones, no shimmer sweep. */
	:global(:root[data-low-power='true']) .bone::after {
		animation: none;
		display: none;
	}
	.bone--text {
		block-size: 0.75em;
		border-radius: var(--nm-radius-xs);
	}
	.bone--last {
		inline-size: 60%;
	}
	.bone--rect {
		border-radius: var(--nm-radius-md);
	}
	.bone--circle {
		border-radius: var(--nm-radius-round);
	}
	@keyframes shimmer {
		to {
			transform: translateX(100%);
		}
	}
</style>
