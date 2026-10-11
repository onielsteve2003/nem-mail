<script lang="ts" module>
	import type { LucideIcon } from '@lucide/svelte';

	export interface ActionSheetItem {
		label: string;
		icon?: LucideIcon;
		/** Red text, for delete-like actions. */
		destructive?: boolean;
		disabled?: boolean;
		onselect: () => void;
	}
</script>

<script lang="ts">
	import BottomSheet from './BottomSheet.svelte';
	import Icon from './Icon.svelte';

	interface Props {
		open?: boolean;
		title: string;
		/** Hide the title visually when the actions speak for themselves. */
		hideTitle?: boolean;
		actions: ActionSheetItem[];
		cancelLabel?: string;
		onclose?: () => void;
	}

	let {
		open = $bindable(false),
		title,
		hideTitle = false,
		actions,
		cancelLabel = 'Cancel',
		onclose
	}: Props = $props();

	function select(action: ActionSheetItem) {
		open = false;
		onclose?.();
		action.onselect();
	}

	function cancel() {
		open = false;
		onclose?.();
	}
</script>

<BottomSheet bind:open {title} {hideTitle} {onclose}>
	<ul class="list">
		{#each actions as action (action.label)}
			<li>
				<button
					type="button"
					class={['item', { 'item--danger': action.destructive }]}
					disabled={action.disabled}
					onclick={() => select(action)}
				>
					{#if action.icon}<Icon icon={action.icon} />{/if}
					<span>{action.label}</span>
				</button>
			</li>
		{/each}
	</ul>
	<button type="button" class="item item--cancel" onclick={cancel}>{cancelLabel}</button>
</BottomSheet>

<style>
	.list {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.item {
		display: flex;
		align-items: center;
		gap: var(--nm-space-4);
		inline-size: 100%;
		min-block-size: var(--nm-size-control-lg);
		padding-inline: var(--nm-space-3);
		border: 0;
		border-radius: var(--nm-radius-md);
		background: none;
		color: var(--nm-color-text);
		font: inherit;
		font-size: var(--nm-text-body-lg);
		text-align: start;
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
	}
	.item:hover:not(:disabled),
	.item:active:not(:disabled) {
		background: var(--nm-color-glass);
	}
	.item:disabled {
		color: var(--nm-color-text-subtle);
		cursor: not-allowed;
	}
	.item--danger {
		color: var(--nm-color-danger);
	}
	.item--cancel {
		justify-content: center;
		margin-block-start: var(--nm-space-2);
		border: 1px solid var(--nm-color-border);
		font-weight: var(--nm-weight-semibold);
	}
</style>
