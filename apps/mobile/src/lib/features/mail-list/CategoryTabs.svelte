<script lang="ts">
	import type { Category } from '@nem/shared';
	import { CATEGORIES } from '@nem/shared';
	import { Spring } from 'svelte/motion';
	import Badge from '#components/ui/Badge.svelte';
	import { springPreset } from '#lib/motion/index.js';
	import { CATEGORY_TITLES, newCountLabel } from './categories.js';

	const TABS_LABEL = 'Inbox categories';

	interface Props {
		value: Category;
		/** Unread ("new") count per tab. */
		counts?: Partial<Record<Category, number>>;
		onchange: (category: Category) => void;
		/** Id of the list the tabs control. */
		controls?: string;
	}

	let { value, counts = {}, onchange, controls }: Props = $props();

	let tabs = $state<HTMLButtonElement[]>([]);
	const index = $derived(Math.max(0, CATEGORIES.indexOf(value)));

	// The indicator slides by whole tabs (equal widths), so nothing is measured.
	const position = new Spring(0, springPreset('snappy'));
	$effect(() => {
		position.target = index;
	});
	// Keep the active tab in view when the strip scrolls.
	$effect(() => {
		tabs[index]?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
	});

	// Arrow keys move between tabs (WAI-ARIA tabs pattern, automatic activation).
	function onkeydown(event: KeyboardEvent): void {
		const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
		const jump = { Home: 0, End: CATEGORIES.length - 1 }[event.key];
		if (step === undefined && jump === undefined) return;
		event.preventDefault();
		const next = jump ?? (index + (step ?? 0) + CATEGORIES.length) % CATEGORIES.length;
		const category = CATEGORIES[next];
		if (!category) return;
		onchange(category);
		tabs[next]?.focus();
	}
</script>

<div class="strip">
	<div class="tabs" role="tablist" aria-label={TABS_LABEL} tabindex="-1" {onkeydown}>
		<span
			class="tabs__indicator"
			aria-hidden="true"
			style="transform: translateX({position.current * 100}%)"
		></span>
		{#each CATEGORIES as category, i (category)}
			{@const count = counts[category] ?? 0}
			<button
				bind:this={tabs[i]}
				type="button"
				role="tab"
				class="tabs__tab"
				aria-selected={category === value}
				aria-controls={controls}
				tabindex={category === value ? 0 : -1}
				onclick={() => onchange(category)}
			>
				<span>{CATEGORY_TITLES[category]}</span>
				{#if category !== 'primary' && count > 0}
					<Badge {count} label={newCountLabel(count)} />
				{/if}
			</button>
		{/each}
	</div>
</div>

<style>
	/* Narrow screens scroll the strip; the tabs keep equal widths so the indicator needs no measuring. */
	.strip {
		overflow-x: auto;
		scrollbar-width: none;
		margin-block-end: var(--nm-space-2);
		border-block-end: 1px solid var(--nm-color-border);
	}
	.strip::-webkit-scrollbar {
		display: none;
	}
	.tabs {
		--tab-min: 6.5rem;
		position: relative;
		display: grid;
		grid-template-columns: repeat(5, 1fr);
		inline-size: max(100%, calc(var(--tab-min) * 5));
	}
	.tabs__indicator {
		position: absolute;
		inset-block-end: 0;
		inset-inline-start: 0;
		inline-size: calc(100% / 5);
		block-size: var(--nm-space-1);
		border-radius: var(--nm-radius-pill) var(--nm-radius-pill) 0 0;
		background: var(--nm-gradient-aurora);
	}
	.tabs__tab {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--nm-space-2);
		min-block-size: var(--nm-size-touch);
		padding-inline: var(--nm-space-3);
		border: 0;
		background: none;
		color: var(--nm-color-text-muted);
		font: inherit;
		font-size: var(--nm-text-label);
		font-weight: var(--nm-weight-semibold);
		white-space: nowrap;
		cursor: pointer;
	}
	.tabs__tab[aria-selected='true'] {
		color: var(--nm-color-text);
	}
	.tabs__tab:focus-visible {
		outline: 2px solid var(--nm-color-focus);
		outline-offset: calc(var(--nm-space-1) * -1);
	}
</style>
