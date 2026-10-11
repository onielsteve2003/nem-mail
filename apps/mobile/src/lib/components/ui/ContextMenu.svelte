<script lang="ts" module>
	import type { ActionSheetItem } from './ActionSheet.svelte';

	/** Same shape as an action sheet item, so a row can offer one list both ways. */
	export type ContextMenuItem = ActionSheetItem;
</script>

<script lang="ts">
	import type { Point, PopoverPlacement } from '#lib/utils/popover.js';
	import Icon from './Icon.svelte';
	import Popover from './Popover.svelte';

	interface Props {
		open?: boolean;
		anchor?: HTMLElement | Point;
		/** Accessible name of the menu, e.g. "Message actions". */
		label: string;
		items: ContextMenuItem[];
		placement?: PopoverPlacement;
		onclose?: () => void;
	}

	let {
		open = $bindable(false),
		anchor,
		label,
		items,
		placement = 'bottom-start',
		onclose
	}: Props = $props();

	const firstEnabled = $derived(items.findIndex((item) => !item.disabled));

	function select(item: ContextMenuItem) {
		open = false;
		onclose?.();
		if (anchor instanceof HTMLElement) anchor.focus();
		item.onselect();
	}

	/** Arrow keys, Home and End move between enabled items and wrap around. */
	function handleKeydown(event: KeyboardEvent) {
		const menu = event.currentTarget as HTMLElement;
		const buttons = Array.from(
			menu.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')
		);
		if (buttons.length === 0) return;
		const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
		const last = buttons.length - 1;
		const next: Record<string, number> = {
			ArrowDown: current >= last ? 0 : current + 1,
			ArrowUp: current <= 0 ? last : current - 1,
			Home: 0,
			End: last
		};
		if (!(event.key in next)) return;
		event.preventDefault();
		buttons[next[event.key] as number]?.focus();
	}
</script>

<Popover bind:open {anchor} {placement} {onclose}>
	<ul class="menu" role="menu" aria-label={label} onkeydown={handleKeydown}>
		{#each items as item, index (item.label)}
			<li role="none">
				<button
					type="button"
					role="menuitem"
					tabindex="-1"
					class={['item', { 'item--danger': item.destructive }]}
					disabled={item.disabled}
					data-autofocus={index === firstEnabled || undefined}
					onclick={() => select(item)}
				>
					{#if item.icon}<Icon icon={item.icon} />{/if}
					<span>{item.label}</span>
				</button>
			</li>
		{/each}
	</ul>
</Popover>

<style>
	.menu {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.item {
		display: flex;
		align-items: center;
		gap: var(--nm-space-3);
		inline-size: 100%;
		min-block-size: var(--nm-size-touch);
		padding-inline: var(--nm-space-3);
		border: 0;
		border-radius: var(--nm-radius-sm);
		background: none;
		color: var(--nm-color-text);
		font: inherit;
		font-size: var(--nm-text-body);
		text-align: start;
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
	}
	.item:hover:not(:disabled),
	.item:focus-visible {
		background: var(--nm-color-glass);
	}
	.item:disabled {
		color: var(--nm-color-text-subtle);
		cursor: not-allowed;
	}
	.item--danger {
		color: var(--nm-color-danger);
	}
</style>
