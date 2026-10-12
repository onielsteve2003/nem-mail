<script lang="ts">
	import Bookmark from '@lucide/svelte/icons/bookmark';
	import CalendarClock from '@lucide/svelte/icons/calendar-clock';
	import Clock from '@lucide/svelte/icons/clock';
	import FilePen from '@lucide/svelte/icons/file-pen';
	import Inbox from '@lucide/svelte/icons/inbox';
	import Mails from '@lucide/svelte/icons/mails';
	import OctagonAlert from '@lucide/svelte/icons/octagon-alert';
	import Send from '@lucide/svelte/icons/send';
	import SendHorizontal from '@lucide/svelte/icons/send-horizontal';
	import Settings from '@lucide/svelte/icons/settings';
	import Star from '@lucide/svelte/icons/star';
	import Tag from '@lucide/svelte/icons/tag';
	import Tags from '@lucide/svelte/icons/tags';
	import Trash from '@lucide/svelte/icons/trash';
	import type { Label, SystemMailbox } from '@nem/shared';
	import { APP_NAME } from '@nem/shared';
	import type { Component } from 'svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import Badge from '#components/ui/Badge.svelte';
	import Divider from '#components/ui/Divider.svelte';
	import Icon from '#components/ui/Icon.svelte';
	import { LABEL_DOT } from '#components/ui/label-colors.js';
	import ListItem from '#components/ui/ListItem.svelte';
	import SectionHeader from '#components/ui/SectionHeader.svelte';
	import { getRepositories } from '#lib/data/provider.js';
	import { getMailboxStore } from '#lib/stores/mailbox.svelte.js';
	import { getSessionStore } from '#lib/stores/session.svelte.js';
	import { getUiStore } from '#lib/stores/ui.svelte.js';
	import { MAILBOX_NAV, labelTree } from './nav.js';

	const NAV_LABEL = 'Mailboxes';
	const LABELS_TITLE = 'Labels';
	const SETTINGS_TITLE = 'Settings';
	const MANAGE_LABELS = 'Manage labels';
	const UNREAD_LABEL = (count: number) => `${count} unread`;
	/** Drafts, outbox and scheduled count items, not unread threads. */
	const ITEM_COUNT_LABEL = (count: number) => `${count} items`;
	const ITEM_COUNTED: readonly SystemMailbox[] = ['drafts', 'outbox', 'scheduled'];

	const ICONS: Record<SystemMailbox, Component> = {
		inbox: Inbox,
		starred: Star,
		snoozed: Clock,
		important: Bookmark,
		sent: Send,
		scheduled: CalendarClock,
		outbox: SendHorizontal,
		drafts: FilePen,
		all: Mails,
		spam: OctagonAlert,
		trash: Trash
	};

	interface Props {
		/** Id of the element the menu slides over (ion-menu content-id). */
		contentId: string;
		/** Allows the edge-swipe open gesture (list screens only). */
		swipe?: boolean;
	}

	let { contentId, swipe = true }: Props = $props();

	const repos = getRepositories();
	const session = getSessionStore();
	const mailbox = getMailboxStore();
	const ui = getUiStore();

	let menu = $state<HTMLIonMenuElement>();
	let labels = $state<Label[]>([]);
	const tree = $derived(labelTree(labels));

	// Labels per account; a failed load leaves the section empty until the next open.
	async function loadLabels(): Promise<void> {
		try {
			labels = await repos.labels.list();
		} catch {
			// The mailboxes still work without labels.
		}
	}

	// Reloads when the labels screen changes them.
	$effect(() => {
		void ui.labelsVersion;
		if (session.user) void loadLabels();
	});

	// The store drives the menu, so the search bar's button and the swipe agree.
	$effect(() => {
		if (!menu) return;
		if (ui.isDrawerOpen) void menu.open();
		else void menu.close();
	});

	function onWillOpen(): void {
		ui.openDrawer();
		void mailbox.refreshCounts().catch(() => {});
		void loadLabels();
	}

	const close = () => ui.closeDrawer();
</script>

<ion-menu
	bind:this={menu}
	content-id={contentId}
	type="overlay"
	swipe-gesture={swipe}
	onionWillOpen={onWillOpen}
	onionDidClose={close}
>
	<div class="drawer">
		<header class="head">
			<p class="nm-text-title-2 nm-text-gradient">{APP_NAME}</p>
			{#if session.user}
				<p class="nm-text-caption nm-text-muted">{session.user.email}</p>
			{/if}
		</header>
		<nav aria-label={NAV_LABEL}>
			<ul>
				{#each MAILBOX_NAV as item (item.mailbox)}
					{@const count = mailbox.counts?.mailboxes[item.mailbox] ?? 0}
					<li>
						<ListItem
							title={item.title}
							href={resolve('/mail/(list)/[mailbox]', { mailbox: item.mailbox })}
							current={page.params['mailbox'] === item.mailbox}
							onclick={close}
						>
							{#snippet leading()}<Icon icon={ICONS[item.mailbox]} />{/snippet}
							{#snippet trailing()}
								<Badge
									{count}
									tone="neutral"
									label={ITEM_COUNTED.includes(item.mailbox)
										? ITEM_COUNT_LABEL(count)
										: UNREAD_LABEL(count)}
								/>
							{/snippet}
						</ListItem>
					</li>
				{/each}
			</ul>
			<Divider />
			<SectionHeader title={LABELS_TITLE} />
			<ul>
				{#each tree as { label, depth } (label.id)}
					{@const count = mailbox.counts?.labels[label.id] ?? 0}
					<li class:nested={depth === 1}>
						<ListItem
							title={label.name}
							href={resolve('/mail/(list)/label/[labelId]', { labelId: label.id })}
							current={page.params['labelId'] === label.id}
							onclick={close}
						>
							{#snippet leading()}
								<span class="dot" style:color={LABEL_DOT[label.color]}>
									<Icon icon={Tag} />
								</span>
							{/snippet}
							{#snippet trailing()}
								<Badge {count} tone="neutral" label={UNREAD_LABEL(count)} />
							{/snippet}
						</ListItem>
					</li>
				{/each}
				<li>
					<ListItem
						title={MANAGE_LABELS}
						href={resolve('/settings/labels')}
						current={page.url.pathname === resolve('/settings/labels')}
						onclick={close}
					>
						{#snippet leading()}<Icon icon={Tags} />{/snippet}
					</ListItem>
				</li>
			</ul>
			<Divider />
			<ul>
				<li>
					<ListItem
						title={SETTINGS_TITLE}
						href={resolve('/settings')}
						current={page.url.pathname === resolve('/settings')}
						onclick={close}
					>
						{#snippet leading()}<Icon icon={Settings} />{/snippet}
					</ListItem>
				</li>
			</ul>
		</nav>
	</div>
</ion-menu>

<style>
	ion-menu {
		--background: var(--nm-color-surface-1);
		--width: min(320px, 85vw);
	}
	ion-menu::part(container) {
		border-start-end-radius: var(--nm-radius-xl);
		border-end-end-radius: var(--nm-radius-xl);
		box-shadow: var(--nm-shadow-3);
	}
	.drawer {
		block-size: 100%;
		overflow-y: auto;
		padding-block: calc(var(--nm-safe-top) + var(--nm-space-4)) var(--nm-safe-bottom);
		padding-inline: max(var(--nm-space-2), var(--nm-safe-left)) var(--nm-space-2);
	}
	.head {
		padding-inline: var(--nm-space-4);
		padding-block-end: var(--nm-space-3);
	}
	ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.nested {
		padding-inline-start: var(--nm-space-6);
	}
	.dot {
		display: contents;
	}
</style>
