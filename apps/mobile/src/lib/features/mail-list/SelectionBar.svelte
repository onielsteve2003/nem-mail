<script lang="ts">
	import CheckCheck from '@lucide/svelte/icons/check-check';
	import X from '@lucide/svelte/icons/x';
	import type { Snippet } from 'svelte';
	import IconButton from '#components/ui/IconButton.svelte';

	const EXIT = 'Exit selection';
	const SELECT_ALL = 'Select all';
	const DESELECT_ALL = 'Deselect all';
	const COUNT = (count: number) => `${count} selected`;

	interface Props {
		count: number;
		/** Every row in the list is selected, so the toggle deselects. */
		isAllSelected: boolean;
		onselectall: () => void;
		onexit: () => void;
		/** Bulk actions (T5.9). */
		actions?: Snippet;
	}

	let { count, isAllSelected, onselectall, onexit, actions }: Props = $props();

	function onkeydown(event: KeyboardEvent): void {
		if (event.key === 'Escape' && !event.defaultPrevented) onexit();
	}
</script>

<svelte:window {onkeydown} />

<!-- Takes the search bar's place while rows are selected. -->
<header class="bar">
	<div class="pill">
		<IconButton icon={X} label={EXIT} onclick={onexit} />
		<span class="count nm-text-numeric" aria-live="polite">{COUNT(count)}</span>
		<IconButton
			icon={CheckCheck}
			label={isAllSelected ? DESELECT_ALL : SELECT_ALL}
			onclick={onselectall}
		/>
		{@render actions?.()}
	</div>
</header>

<style>
	.bar {
		position: sticky;
		inset-block-start: 0;
		z-index: var(--nm-z-sticky);
		padding-block: calc(var(--nm-safe-top) + var(--nm-space-2)) var(--nm-space-2);
		padding-inline: max(var(--nm-space-3), var(--nm-safe-left))
			max(var(--nm-space-3), var(--nm-safe-right));
	}
	.pill {
		display: flex;
		align-items: center;
		gap: var(--nm-space-1);
		padding: var(--nm-space-1);
		border: 1px solid var(--nm-color-accent);
		border-radius: var(--nm-radius-pill);
		background: var(--nm-color-surface-2);
		box-shadow: var(--nm-shadow-2);
	}
	.count {
		flex: 1;
		overflow: hidden;
		min-inline-size: 0;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--nm-color-text);
		font-weight: var(--nm-weight-semibold);
	}
</style>
