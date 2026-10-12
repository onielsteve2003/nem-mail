<script lang="ts">
	import type { Category, ThreadListFilter } from '@nem/shared';
	import { mailboxTitle } from '#components/layout/nav.js';
	import CategoryBundles from '#lib/features/mail-list/CategoryBundles.svelte';
	import CategoryTabs from '#lib/features/mail-list/CategoryTabs.svelte';
	import DraftList from '#lib/features/mail-list/DraftList.svelte';
	import PurgeBanner from '#lib/features/mail-list/PurgeBanner.svelte';
	import { CATEGORY_TITLES } from '#lib/features/mail-list/categories.js';
	import MailList from '#lib/features/mail-list/MailList.svelte';
	import { getMailboxStore, listKey } from '#lib/stores/mailbox.svelte.js';
	import { getUiStore } from '#lib/stores/ui.svelte.js';
	import type { PageProps } from './$types';

	const LIST_ID = 'mail-list';

	let { data }: PageProps = $props();

	const mailbox = getMailboxStore();
	const ui = getUiStore();
	// The inbox splits into tabs (FR-2.2); every other mailbox is one list.
	const isInbox = $derived(data.mailbox === 'inbox');
	let category = $state<Category>('primary');
	const counts = $derived(mailbox.counts?.categories ?? {});

	const filter = $derived<ThreadListFilter>(
		isInbox ? { mailbox: 'inbox', category } : { mailbox: data.mailbox }
	);
	const title = $derived(isInbox ? CATEGORY_TITLES[category] : mailboxTitle(data.mailbox));

	// Trash and Spam warn about the 30-day purge; T8.5 renders the empty confirmation.
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
		<MailList {filter} {title} id={LIST_ID}>
			{#snippet header()}
				{#if isInbox}
					<CategoryTabs
						value={category}
						{counts}
						controls={LIST_ID}
						onchange={(next) => (category = next)}
					/>
					{#if category === 'primary'}
						<CategoryBundles {counts} onopen={(next) => (category = next)} />
					{/if}
				{:else if purgeMailbox}
					<PurgeBanner
						mailbox={purgeMailbox}
						isEmpty={isListEmpty}
						onempty={() => ui.openSheet(`empty-${purgeMailbox}`)}
					/>
				{/if}
			{/snippet}
		</MailList>
	{/if}
</main>
