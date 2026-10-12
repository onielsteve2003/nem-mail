<script lang="ts">
	import Info from '@lucide/svelte/icons/info';
	import MessagesSquare from '@lucide/svelte/icons/messages-square';
	import Tag from '@lucide/svelte/icons/tag';
	import Users from '@lucide/svelte/icons/users';
	import type { Category } from '@nem/shared';
	import { untrack, type Component } from 'svelte';
	import Badge from '#components/ui/Badge.svelte';
	import Icon from '#components/ui/Icon.svelte';
	import { getMailboxStore } from '#lib/stores/mailbox.svelte.js';
	import {
		BUNDLED_CATEGORIES,
		CATEGORY_TITLES,
		bundleSenders,
		newCountLabel
	} from './categories.js';

	const ICONS: Record<(typeof BUNDLED_CATEGORIES)[number], Component> = {
		promotions: Tag,
		social: Users,
		updates: Info,
		forums: MessagesSquare
	};

	interface Props {
		/** Unread ("new") count per tab; tabs with none get no bundle. */
		counts?: Partial<Record<Category, number>>;
		onopen: (category: Category) => void;
	}

	let { counts = {}, onopen }: Props = $props();

	const mailbox = getMailboxStore();
	const bundles = $derived(BUNDLED_CATEGORIES.filter((category) => (counts[category] ?? 0) > 0));

	// The other tabs' first pages name their senders (and make switching tabs instant).
	$effect(() => {
		for (const category of bundles) {
			untrack(() => void mailbox.load({ mailbox: 'inbox', category }));
		}
	});

	function senders(category: Category): string {
		return bundleSenders(mailbox.list({ mailbox: 'inbox', category })?.items ?? []);
	}
</script>

{#if bundles.length > 0}
	<ul class="bundles">
		{#each bundles as category (category)}
			{@const count = counts[category] ?? 0}
			<li>
				<button type="button" class="bundle" onclick={() => onopen(category)}>
					<span class="bundle__icon"><Icon icon={ICONS[category]} /></span>
					<span class="bundle__text">
						<span class="bundle__title">{CATEGORY_TITLES[category]}</span>
						<span class="bundle__senders nm-text-truncate">{senders(category)}</span>
					</span>
					<Badge {count} label={newCountLabel(count)} />
				</button>
			</li>
		{/each}
	</ul>
{/if}

<style>
	.bundles {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.bundle {
		display: flex;
		align-items: center;
		gap: var(--nm-space-3);
		inline-size: 100%;
		min-block-size: var(--nm-size-touch);
		padding-block: var(--nm-space-2);
		padding-inline: var(--nm-space-4);
		border: 0;
		border-radius: var(--nm-radius-lg);
		background: none;
		color: var(--nm-color-text);
		font: inherit;
		text-align: start;
		cursor: pointer;
	}
	.bundle:hover {
		background: var(--nm-color-surface-1);
	}
	.bundle:focus-visible {
		outline: 2px solid var(--nm-color-focus);
		outline-offset: calc(var(--nm-space-1) * -1);
	}
	.bundle__icon {
		display: grid;
		flex: none;
		place-items: center;
		inline-size: var(--nm-size-avatar-md);
		block-size: var(--nm-size-avatar-md);
		border-radius: var(--nm-radius-round);
		background: var(--nm-color-accent-soft);
		color: var(--nm-color-accent-text);
	}
	.bundle__text {
		display: flex;
		flex: 1;
		flex-direction: column;
		min-inline-size: 0;
	}
	.bundle__title {
		font-weight: var(--nm-weight-bold);
	}
	.bundle__senders {
		color: var(--nm-color-text-subtle);
		font-size: var(--nm-text-label);
	}
</style>
