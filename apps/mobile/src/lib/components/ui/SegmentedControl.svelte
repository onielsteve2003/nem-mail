<script lang="ts" module>
	export interface Segment<T extends string> {
		value: T;
		label: string;
	}
</script>

<script lang="ts" generics="T extends string">
	import { Spring } from 'svelte/motion';
	import { springPreset } from '#lib/motion/index.js';

	interface Props {
		/** Accessible name of the group, e.g. "Density". */
		label: string;
		options: Segment<T>[];
		value: T;
		onchange?: (value: T) => void;
		disabled?: boolean;
		class?: string;
	}

	let {
		label,
		options,
		value = $bindable(),
		onchange,
		disabled = false,
		class: className
	}: Props = $props();

	// Native radios give arrow-key navigation and the radiogroup semantics for free.
	const name = $props.id();
	const index = $derived(
		Math.max(
			0,
			options.findIndex((option) => option.value === value)
		)
	);

	// The indicator slides by whole segments, so no layout measuring is needed.
	const position = new Spring(0, springPreset('snappy'));
	$effect(() => {
		position.target = index;
	});

	function select(next: T) {
		value = next;
		onchange?.(next);
	}
</script>

<div
	class={['segmented', { 'segmented--disabled': disabled }, className]}
	role="radiogroup"
	aria-label={label}
	style="--segments: {options.length}"
>
	<span
		class="segmented__indicator"
		aria-hidden="true"
		style="transform: translateX({position.current * 100}%)"
	></span>
	{#each options as option (option.value)}
		<label class="segmented__option" class:segmented__option--active={option.value === value}>
			<input
				type="radio"
				class="nm-visually-hidden"
				{name}
				value={option.value}
				checked={option.value === value}
				{disabled}
				onchange={() => select(option.value)}
			/>
			<span>{option.label}</span>
		</label>
	{/each}
</div>

<style>
	.segmented {
		position: relative;
		display: grid;
		grid-template-columns: repeat(var(--segments), minmax(0, 1fr));
		padding: var(--nm-space-2);
		border-radius: var(--nm-radius-pill);
		background: var(--nm-color-surface-2);
		font-family: var(--nm-font-body);
	}
	.segmented--disabled {
		opacity: 0.45;
	}

	.segmented__indicator {
		position: absolute;
		inset-block: var(--nm-space-2);
		inset-inline-start: var(--nm-space-2);
		inline-size: calc((100% - var(--nm-space-2) * 2) / var(--segments));
		border-radius: var(--nm-radius-pill);
		background: var(--nm-color-accent);
		box-shadow: var(--nm-glow-violet);
		will-change: transform;
	}

	.segmented__option {
		position: relative;
		display: grid;
		place-items: center;
		min-block-size: calc(var(--nm-size-touch) - var(--nm-space-2) * 2);
		padding-inline: var(--nm-space-4);
		border-radius: var(--nm-radius-pill);
		color: var(--nm-color-text-muted);
		font-size: var(--nm-text-label);
		font-weight: var(--nm-weight-semibold);
		text-align: center;
		cursor: pointer;
		user-select: none;
		-webkit-tap-highlight-color: transparent;
		transition: color var(--nm-duration-fast) var(--nm-ease-standard);
	}
	/* Reach into the track padding so each segment is a full 44px touch target. */
	.segmented__option::after {
		content: '';
		position: absolute;
		inset-block: calc(var(--nm-space-2) * -1);
		inset-inline: 0;
	}
	.segmented__option--active {
		color: var(--nm-color-on-accent);
	}
	.segmented--disabled .segmented__option {
		cursor: not-allowed;
	}
	.segmented__option:has(input:focus-visible) {
		outline: 2px solid var(--nm-color-focus);
		outline-offset: 2px;
	}
</style>
