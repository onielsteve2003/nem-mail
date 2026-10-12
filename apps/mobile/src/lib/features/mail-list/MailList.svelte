<script lang="ts">
	import type { Label, Settings, ThreadListFilter, ThreadSummary } from '@nem/shared';
	import { DEFAULT_SETTINGS } from '@nem/shared';
	import { untrack, type Snippet } from 'svelte';
	import { MediaQuery } from 'svelte/reactivity';
	import { online } from 'svelte/reactivity/window';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import EmptyState from '#components/ui/EmptyState.svelte';
	import ErrorState from '#components/ui/ErrorState.svelte';
	import Skeleton from '#components/ui/Skeleton.svelte';
	import { getRepositories } from '#lib/data/provider.js';
	import { getMailboxStore, listKey } from '#lib/stores/mailbox.svelte.js';
	import { getSessionStore } from '#lib/stores/session.svelte.js';
	import { TWO_PANE_QUERY, readingThreadId, withReadingThread } from '#lib/utils/reading-pane.js';
	import { emptyCopy, errorCopy } from './list-states.js';
	import MailRow from './MailRow.svelte';

	const SKELETON_ROWS = 8;
	const LOADING = 'Loading conversations';

	interface Props {
		filter: ThreadListFilter;
		/** Heading over the list; a label list falls back to the label's name. */
		title?: string;
		/** Sits between the heading and the rows, e.g. the inbox tabs. */
		header?: Snippet;
		/** Id of the rows region, e.g. for tabs that control it. */
		id?: string;
	}

	let { filter, title, header, id }: Props = $props();

	const repos = getRepositories();
	const mailbox = getMailboxStore();
	const session = getSessionStore();

	let labels = $state<Label[]>([]);
	let density = $state<Settings['density']>(DEFAULT_SETTINGS.density);
	const labelsById = $derived(new Map(labels.map((label) => [label.id, label])));

	// Labels and density per account; rows still render if either fails.
	$effect(() => {
		if (!session.user) return;
		repos.labels.list().then(
			(list) => (labels = list),
			() => {}
		);
		repos.settings.get().then(
			(settings) => (density = settings.density),
			() => {}
		);
	});

	// Load when the filter changes; the store skips fresh cached lists.
	const key = $derived(listKey(filter));
	$effect(() => {
		void key;
		untrack(() => void mailbox.load(filter));
	});

	const list = $derived(mailbox.lists[key]);
	const isOffline = $derived(online.current === false);
	const empty = $derived(emptyCopy('mailbox' in filter ? filter.mailbox : null));
	const failure = $derived(errorCopy(isOffline));
	const heading = $derived(
		title ?? ('labelId' in filter ? (labelsById.get(filter.labelId)?.name ?? '') : '')
	);

	const twoPane = new MediaQuery(TWO_PANE_QUERY, false);
	const openId = $derived(readingThreadId(page.url));

	function href(thread: ThreadSummary): string {
		return twoPane.current
			? withReadingThread(page.url, thread.id)
			: resolve('/mail/thread/[threadId]', { threadId: thread.id });
	}

	function rowLabels(thread: ThreadSummary): Label[] {
		return thread.labelIds.flatMap((id) => labelsById.get(id) ?? []);
	}
</script>

<section class="list" aria-labelledby="list-heading">
	<h1 id="list-heading" class="list__title nm-text-label">{heading}</h1>
	{@render header?.()}
	<div {id} role={id ? 'tabpanel' : undefined}>
		{#if !list || list.status === 'loading'}
			<div class="skeleton" role="status" aria-label={LOADING}>
				{#each { length: SKELETON_ROWS }, index (index)}
					<div class="skeleton__row">
						<Skeleton shape="circle" width="var(--nm-size-avatar-md)" />
						<Skeleton lines={3} class="skeleton__text" />
					</div>
				{/each}
			</div>
		{:else if list.status === 'error'}
			<ErrorState
				title={failure.title}
				message={failure.message}
				illustration={failure.illustration}
				onretry={() => void mailbox.load(filter, { refresh: true })}
			/>
		{:else if list.items.length === 0}
			<EmptyState title={empty.title} message={empty.message} illustration={empty.illustration} />
		{:else}
			<ul class="rows">
				{#each list.items as thread (thread.id)}
					<li>
						<MailRow
							{thread}
							href={href(thread)}
							labels={rowLabels(thread)}
							{density}
							selfEmail={session.user?.email}
							active={twoPane.current && openId === thread.id}
						/>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</section>

<style>
	.list {
		padding-block-end: calc(var(--nm-safe-bottom) + var(--nm-space-11));
		padding-inline: calc(var(--nm-safe-left) + var(--nm-space-2))
			calc(var(--nm-safe-right) + var(--nm-space-2));
	}
	.list__title {
		margin: 0;
		padding-block: var(--nm-space-2);
		padding-inline: var(--nm-space-4);
		color: var(--nm-color-text-subtle);
	}
	.rows {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.skeleton__row {
		display: flex;
		gap: var(--nm-space-3);
		padding-block: var(--nm-space-3);
		padding-inline: var(--nm-space-4);
	}
	.skeleton__row :global(.skeleton__text) {
		flex: 1;
	}
</style>
