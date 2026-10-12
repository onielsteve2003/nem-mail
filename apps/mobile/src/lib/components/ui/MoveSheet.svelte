<script lang="ts">
	import type { LucideIcon } from '@lucide/svelte';
	import Archive from '@lucide/svelte/icons/archive';
	import Inbox from '@lucide/svelte/icons/inbox';
	import LayoutGrid from '@lucide/svelte/icons/layout-grid';
	import OctagonAlert from '@lucide/svelte/icons/octagon-alert';
	import Tag from '@lucide/svelte/icons/tag';
	import Trash from '@lucide/svelte/icons/trash';
	import { CATEGORIES, type Category, type Label, type ThreadOp } from '@nem/shared';
	import { filterLabels, moveOps, type MoveTarget } from '#lib/utils/thread-actions.js';
	import BottomSheet from './BottomSheet.svelte';
	import Icon from './Icon.svelte';

	const COPY = {
		title: 'Move to',
		mailboxes: 'Mailboxes',
		labels: 'Labels',
		categories: 'Inbox tabs',
		cancel: 'Cancel'
	};
	const MAILBOXES = [
		{ to: 'inbox', label: 'Inbox', icon: Inbox },
		{ to: 'archive', label: 'Archive', icon: Archive },
		{ to: 'spam', label: 'Spam', icon: OctagonAlert },
		{ to: 'trash', label: 'Trash', icon: Trash }
	] as const;
	const CATEGORY_NAMES: Record<Category, string> = {
		primary: 'Primary',
		promotions: 'Promotions',
		social: 'Social',
		updates: 'Updates',
		forums: 'Forums'
	};

	interface Option {
		key: string;
		label: string;
		icon: LucideIcon;
		target: MoveTarget;
		isChild?: boolean;
	}

	interface Props {
		open?: boolean;
		labels: readonly Label[];
		/** The ops for the chosen place, run as one change. */
		onmove: (ops: ThreadOp[]) => void;
		onclose?: () => void;
	}

	let { open = $bindable(false), labels, onmove, onclose }: Props = $props();

	const id = $props.id();
	const sections = $derived<{ title: string; options: Option[] }[]>([
		{
			title: COPY.mailboxes,
			options: MAILBOXES.map(({ to, label, icon }) => ({
				key: to,
				label,
				icon,
				target: { kind: 'mailbox', to }
			}))
		},
		{
			title: COPY.labels,
			options: filterLabels(labels, '').map((label) => ({
				key: label.id,
				label: label.name,
				icon: Tag,
				target: { kind: 'label', labelId: label.id },
				isChild: label.parentId !== null
			}))
		},
		{
			title: COPY.categories,
			options: CATEGORIES.map((category) => ({
				key: category,
				label: CATEGORY_NAMES[category],
				icon: LayoutGrid,
				target: { kind: 'category', category }
			}))
		}
	]);

	function close(): void {
		open = false;
		onclose?.();
	}

	// Moves before closing, so a parent that clears its target on close still has it.
	function choose(target: MoveTarget): void {
		onmove(moveOps(target));
		close();
	}
</script>

<BottomSheet bind:open title={COPY.title} {onclose} snapPoints={[0.6, 0.92]}>
	{#each sections as section, index (section.title)}
		{#if section.options.length > 0}
			<h3 id="{id}-{index}" class="heading nm-text-label">{section.title}</h3>
			<ul class="list" aria-labelledby="{id}-{index}">
				{#each section.options as option (option.key)}
					<li>
						<button
							type="button"
							class={['item', { 'item--child': option.isChild }]}
							onclick={() => choose(option.target)}
						>
							<Icon icon={option.icon} />
							<span>{option.label}</span>
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	{/each}
	<button type="button" class="item item--cancel" onclick={close}>{COPY.cancel}</button>
</BottomSheet>

<style>
	.heading {
		margin: 0;
		padding-block: var(--nm-space-3) var(--nm-space-1);
		padding-inline: var(--nm-space-3);
		color: var(--nm-color-text-subtle);
	}
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
	.item--child {
		padding-inline-start: var(--nm-space-8);
	}
	.item:hover,
	.item:active {
		background: var(--nm-color-glass);
	}
	.item--cancel {
		justify-content: center;
		margin-block-start: var(--nm-space-3);
		border: 1px solid var(--nm-color-border);
		font-weight: var(--nm-weight-semibold);
	}
</style>
