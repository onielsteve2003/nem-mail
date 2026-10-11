<script lang="ts">
	interface Props {
		size?: 'sm' | 'md' | 'lg';
		/** Announced to screen readers. Leave out when nearby text already says it is loading. */
		label?: string;
		class?: string;
	}

	let { size = 'md', label, class: className }: Props = $props();
</script>

<span
	class={['spinner', `spinner--${size}`, className]}
	role={label ? 'status' : undefined}
	aria-hidden={label ? undefined : 'true'}
>
	<svg viewBox="0 0 24 24" fill="none">
		<circle class="track" cx="12" cy="12" r="9" stroke-width="3" />
		<circle
			class="arc"
			cx="12"
			cy="12"
			r="9"
			stroke-width="3"
			stroke-linecap="round"
			pathLength="100"
		/>
	</svg>
	{#if label}<span class="nm-visually-hidden">{label}</span>{/if}
</span>

<style>
	.spinner {
		display: inline-flex;
		flex: none;
	}
	.spinner--sm {
		inline-size: var(--nm-size-icon-sm);
	}
	.spinner--md {
		inline-size: var(--nm-size-icon-lg);
	}
	.spinner--lg {
		inline-size: var(--nm-size-icon-xl);
	}
	svg {
		inline-size: 100%;
		block-size: auto;
		animation: spin calc(var(--nm-duration-slower) * 1.6) linear infinite;
	}
	.track {
		stroke: var(--nm-color-border);
	}
	.arc {
		stroke: var(--nm-color-accent-text);
		stroke-dasharray: 30 100;
	}
	@keyframes spin {
		to {
			transform: rotate(1turn);
		}
	}
</style>
