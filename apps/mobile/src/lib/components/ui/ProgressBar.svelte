<script lang="ts">
	interface Props {
		/** 0 to 1. Leave out for an indeterminate bar. */
		value?: number;
		/** Names the progress bar, e.g. "Downloading model". */
		label: string;
		/** Shows the label and percentage above the bar. */
		showLabel?: boolean;
		class?: string;
	}

	let { value, label, showLabel = false, class: className }: Props = $props();

	const percent = $derived(
		value === undefined ? undefined : Math.round(Math.min(Math.max(value, 0), 1) * 100)
	);
</script>

<div class={['progress', className]}>
	{#if showLabel}
		<div class="caption" aria-hidden="true">
			<span>{label}</span>
			{#if percent !== undefined}<span>{percent}%</span>{/if}
		</div>
	{/if}
	<div
		class="track"
		role="progressbar"
		aria-label={label}
		aria-valuemin={0}
		aria-valuemax={100}
		aria-valuenow={percent}
	>
		<span
			class={['fill', { 'fill--indeterminate': percent === undefined }]}
			style:transform={percent === undefined ? undefined : `scaleX(${percent / 100})`}
		></span>
	</div>
</div>

<style>
	.progress {
		display: grid;
		gap: var(--nm-space-2);
	}
	.caption {
		display: flex;
		justify-content: space-between;
		color: var(--nm-color-text-muted);
		font-size: var(--nm-text-caption);
	}
	.track {
		position: relative;
		overflow: hidden;
		block-size: var(--nm-space-1);
		border-radius: var(--nm-radius-pill);
		background: var(--nm-color-surface-3);
	}
	.fill {
		position: absolute;
		inset: 0;
		background: var(--nm-gradient-aurora);
		transform-origin: left;
		transition: transform var(--nm-duration-base) var(--nm-ease-standard);
	}
	.fill--indeterminate {
		inset-inline-end: 60%;
		animation: sweep calc(var(--nm-duration-slower) * 3) var(--nm-ease-standard) infinite;
	}
	@keyframes sweep {
		from {
			transform: translateX(-100%);
		}
		to {
			transform: translateX(250%);
		}
	}
</style>
