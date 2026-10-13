<script lang="ts">
	import type { Category, ThreadListFilter } from '@nem/shared';
	import { mailboxTitle } from '#components/layout/nav.js';
	import ConfirmDialog from '#components/ui/ConfirmDialog.svelte';
	import SegmentedControl from '#components/ui/SegmentedControl.svelte';
	import CategoryBundles from '#lib/features/mail-list/CategoryBundles.svelte';
	import CategoryTabs from '#lib/features/mail-list/CategoryTabs.svelte';
	import DraftList from '#lib/features/mail-list/DraftList.svelte';
	import PurgeBanner from '#lib/features/mail-list/PurgeBanner.svelte';
	import { CATEGORY_TITLES } from '#lib/features/mail-list/categories.js';
	import MailList from '#lib/features/mail-list/MailList.svelte';
	import NudgeRows from '#lib/features/mail-list/NudgeRows.svelte';
	import type { ListSort } from '#lib/features/mail-list/priority.js';
	import { getMailboxStore, listKey } from '#lib/stores/mailbox.svelte.js';
	import type { PageProps } from './$types';

	const LIST_ID = 'mail-list';
	const EMPTY_COPY = {
		trash: { title: 'Empty Trash?', message: 'Everything in Trash will be deleted forever.' },
		spam: { title: 'Empty Spam?', message: 'Everything in Spam will be deleted forever.' }
	} as const;
	const SORT_LABEL = 'Sort conversations';
	const SORTS: { value: ListSort; label: string }[] = [
		{ value: 'newest', label: 'Newest' },
		{ value: 'priority', label: 'Priority' }
	];
	const CANT_UNDO = "This can't be undone.";
	const EMPTY_NOW = 'Empty now';

	let { data }: PageProps = $props();

	const mailbox = getMailboxStore();
	let isConfirmingEmpty = $state(false);
	// The inbox splits into tabs (FR-2.2); every other mailbox is one list.
	const isInbox = $derived(data.mailbox === 'inbox');
	let category = $state<Category>('primary');
	// AI-6 priority inbox: rank the loaded conversations by importance.
	let sort = $state<ListSort>('newest');
	const counts = $derived(mailbox.counts?.categories ?? {});

	const filter = $derived<ThreadListFilter>(
		isInbox ? { mailbox: 'inbox', category } : { mailbox: data.mailbox }
	);
	const title = $derived(isInbox ? CATEGORY_TITLES[category] : mailboxTitle(data.mailbox));

	// Trash and Spam warn about the 30-day purge and can be emptied (FR-6.4).
	const purgeMailbox = $derived(
		data.mailbox === 'trash' || data.mailbox === 'spam' ? data.mailbox : null
	);
	const isListEmpty = $derived((mailbox.lists[listKey(filter)]?.items.length ?? 0) === 0);

	$effect(() => {
		if (isInbox) void mailbox.refreshCounts().catch(() => {});
	});
</script>

<svelte:head>
	<title>{isInbox ? mailboxTitle('inbox') : title} · Nem Mail</title>
</svelte:head>

<main>
	{#if data.mailbox === 'drafts'}
		<DraftList />
	{:else}
		<MailList {filter} {title} id={LIST_ID} sort={isInbox ? sort : 'newest'}>
			{#snippet header()}
				{#if isInbox}
					<CategoryTabs
						value={category}
						{counts}
						controls={LIST_ID}
						onchange={(next) => (category = next)}
					/>
					<SegmentedControl label={SORT_LABEL} options={SORTS} bind:value={sort} class="sort" />
					{#if category === 'primary'}
						<CategoryBundles {counts} onopen={(next) => (category = next)} />
						<NudgeRows />
					{/if}
				{:else if purgeMailbox}
					<PurgeBanner
						mailbox={purgeMailbox}
						isEmpty={isListEmpty}
						onempty={() => (isConfirmingEmpty = true)}
					/>
				{/if}
			{/snippet}
		</MailList>
	{/if}
	{#if purgeMailbox}
		<ConfirmDialog
			bind:open={isConfirmingEmpty}
			title={EMPTY_COPY[purgeMailbox].title}
			message={`${EMPTY_COPY[purgeMailbox].message} ${CANT_UNDO}`}
			confirmLabel={EMPTY_NOW}
			destructive
			onconfirm={() => void mailbox.empty(purgeMailbox)}
		/>
	{/if}
</main>

<style>
	main :global(.sort) {
		margin-block: var(--nm-space-2);
		margin-inline: var(--nm-space-4);
	}
</style>
