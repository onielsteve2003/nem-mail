<script lang="ts">
	import type {
		Label,
		Settings,
		SwipeAction,
		ThreadListFilter,
		ThreadOp,
		ThreadSummary
	} from '@nem/shared';
	import { DEFAULT_SETTINGS } from '@nem/shared';
	import { untrack, type Snippet } from 'svelte';
	import { MediaQuery } from 'svelte/reactivity';
	import { online } from 'svelte/reactivity/window';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import AIBadge from '#components/ui/AIBadge.svelte';
	import EmptyState from '#components/ui/EmptyState.svelte';
	import ErrorState from '#components/ui/ErrorState.svelte';
	import Skeleton from '#components/ui/Skeleton.svelte';
	import { IMPORTANT_THRESHOLD } from '#lib/ai/models/priority-lr.js';
	import { getAIService } from '#lib/ai/service.svelte.js';
	import { getRepositories } from '#lib/data/provider.js';
	import { getMailboxStore, listKey } from '#lib/stores/mailbox.svelte.js';
	import { getSelectionStore } from '#lib/stores/selection.svelte.js';
	import { getSessionStore } from '#lib/stores/session.svelte.js';
	import { getUiStore } from '#lib/stores/ui.svelte.js';
	import { snoozePresets } from '#lib/utils/thread-actions.js';
	import { TWO_PANE_QUERY, readingThreadId, withReadingThread } from '#lib/utils/reading-pane.js';
	import MoveSheet from '#components/ui/MoveSheet.svelte';
	import ThreadActions from '#components/ui/ThreadActions.svelte';
	import TimeSheet from '#components/ui/TimeSheet.svelte';
	import { rowText } from './format.js';
	import { emptyCopy, errorCopy } from './list-states.js';
	import MailRow from './MailRow.svelte';
	import MailRows from './MailRows.svelte';
	import { priorityOrder, type ListSort } from './priority.js';
	import { getListRefresh } from './refresh.js';
	import SelectionBar from './SelectionBar.svelte';
	import { swipeOp } from './swipe.js';
	import SwipeRow from './SwipeRow.svelte';

	const SKELETON_ROWS = 8;
	const LOADING = 'Loading conversations';
	const SNOOZE_TITLE = 'Snooze until';
	const SNOOZE_CONFIRM = 'Snooze';

	interface Props {
		filter: ThreadListFilter;
		/** Heading over the list; a label list falls back to the label's name. */
		title?: string;
		/** Sits between the heading and the rows, e.g. the inbox tabs. */
		header?: Snippet;
		/** Id of the rows region, e.g. for tabs that control it. */
		id?: string;
		/** Row order; "priority" ranks the loaded rows by the AI-6 score. */
		sort?: ListSort;
	}

	let { filter, title, header, id, sort = 'newest' }: Props = $props();

	const repos = getRepositories();
	const mailbox = getMailboxStore();
	const session = getSessionStore();
	const ui = getUiStore();
	const selection = getSelectionStore();
	const ai = getAIService();

	let labels = $state<Label[]>([]);
	let density = $state<Settings['density']>(DEFAULT_SETTINGS.density);
	let swipe = $state<Settings['swipe']>(DEFAULT_SETTINGS.swipe);
	const labelsById = $derived(new Map(labels.map((label) => [label.id, label])));

	// Labels, density and swipe actions per account; rows still render if either fails.
	$effect(() => {
		if (!session.user) return;
		repos.labels.list().then(
			(list) => (labels = list),
			() => {}
		);
		repos.settings.get().then(
			(settings) => {
				density = settings.density;
				swipe = settings.swipe;
			},
			() => {}
		);
	});

	// Load when the filter changes; the store skips fresh cached lists.
	const key = $derived(listKey(filter));
	$effect(() => {
		void key;
		untrack(() => void mailbox.load(filter));
		mailbox.activeKey = key;
	});

	// Pull to refresh in the list layout reloads this list.
	const listRefresh = getListRefresh();
	$effect(() => {
		const current = filter;
		return listRefresh.register(() => mailbox.refresh(current));
	});

	const list = $derived(mailbox.lists[key]);

	// AI-6: score the loaded rows for the Priority sort. Unscored rows (model off,
	// still working, or failed) fall back to the user's own flags.
	const isPriority = $derived(sort === 'priority');
	$effect(() => {
		const user = session.user;
		const items = list?.items;
		if (!isPriority || !user || !items?.length) return;
		untrack(() =>
			ai
				.scorePriority(user, items)
				.catch((error: unknown) => console.error('Priority scoring failed', error))
		);
	});
	const rows = $derived(
		isPriority ? priorityOrder(list?.items ?? [], ai.priority) : (list?.items ?? [])
	);

	// Selection belongs to one list: switching lists or leaving ends it.
	$effect(() => {
		void key;
		return () => selection.clear();
	});
	const isAllSelected = $derived(
		!!list && list.items.length > 0 && list.items.every((thread) => selection.has(thread.id))
	);

	const selected = $derived(list?.items.filter((thread) => selection.has(thread.id)) ?? []);

	/** Deletes the selection forever (confirmed in ThreadActions) and leaves selection mode. */
	function deleteSelection(): void {
		const ids = [...selection.ids];
		selection.clear();
		void mailbox.deleteForever(ids);
	}

	/** Runs a bulk action and leaves selection mode; the store toasts and offers Undo. */
	function applyToSelection(op: ThreadOp | ThreadOp[]): void {
		const ids = [...selection.ids];
		selection.clear();
		void mailbox.apply(ids, op);
	}

	/** Inline create from the label picker; the drawer and other lists pick it up too. */
	async function createLabel(name: string): Promise<Label> {
		const label = await repos.labels.create({ name, color: 'neutral', parentId: null });
		labels = [...labels, label];
		ui.labelsChanged();
		return label;
	}

	function selectAll(): void {
		if (isAllSelected) selection.clear();
		else selection.select(list?.items.map((thread) => thread.id) ?? []);
	}
	const isOffline = $derived(online.current === false);
	const mailboxName = $derived('mailbox' in filter ? filter.mailbox : null);
	const empty = $derived(emptyCopy(mailboxName));
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

	function onswipe(thread: ThreadSummary, action: SwipeAction): void {
		const op = swipeOp(action, thread);
		if (op) void mailbox.apply([thread.id], op);
		else if (action === 'snooze') snoozing = thread.id;
		else if (action === 'move') moving = thread.id;
	}

	/** The swiped thread "Move to" or snooze is choosing for. */
	let moving = $state<string | null>(null);
	let snoozing = $state<string | null>(null);

	function rowLabels(thread: ThreadSummary): Label[] {
		return thread.labelIds.flatMap((id) => labelsById.get(id) ?? []);
	}
</script>

<!-- Inside the row's link, so a plain badge; the thread header explains the score. -->
{#snippet priorityBadge()}
	<AIBadge />
{/snippet}

<MoveSheet
	open={moving !== null}
	{labels}
	onmove={(ops) => {
		if (moving) void mailbox.apply([moving], ops);
	}}
	onclose={() => (moving = null)}
/>
<TimeSheet
	open={snoozing !== null}
	title={SNOOZE_TITLE}
	presets={snoozePresets}
	confirmLabel={SNOOZE_CONFIRM}
	onpick={(until) => {
		if (snoozing) void mailbox.apply([snoozing], { op: 'snooze', until: until.toISOString() });
	}}
	onclose={() => (snoozing = null)}
/>

<section class="list" aria-labelledby="list-heading">
	{#if selection.isActive}
		<SelectionBar
			count={selection.count}
			{isAllSelected}
			onselectall={selectAll}
			onexit={() => selection.clear()}
		>
			{#snippet actions()}
				<ThreadActions
					threads={selected}
					{labels}
					onapply={applyToSelection}
					oncreatelabel={createLabel}
					ondeleteforever={deleteSelection}
				/>
			{/snippet}
		</SelectionBar>
	{/if}
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
			<!-- A new list replaces the rows outright instead of collapsing the old ones. -->
			{#key key}
				<MailRows
					items={rows}
					hasMore={list.nextCursor !== null}
					isLoadingMore={list.isLoadingMore}
					onloadmore={() => void mailbox.loadMore(filter)}
				>
					{#snippet row(thread)}
						<SwipeRow
							actions={swipe}
							isUnread={thread.isUnread}
							disabled={selection.isActive}
							onswipe={(action) => onswipe(thread, action)}
						>
							<MailRow
								{thread}
								href={href(thread)}
								labels={rowLabels(thread)}
								{density}
								selfEmail={session.user?.email}
								text={rowText(mailboxName, thread, Date.now(), session.user?.email)}
								active={twoPane.current && openId === thread.id}
								selected={selection.has(thread.id)}
								selecting={selection.isActive}
								onselect={() => selection.toggle(thread.id)}
								onlongpress={() => selection.select([thread.id])}
								onstar={() =>
									void mailbox.apply([thread.id], { op: thread.isStarred ? 'unstar' : 'star' })}
								onimportant={() =>
									void mailbox.apply([thread.id], {
										op: thread.isImportant ? 'markNotImportant' : 'markImportant'
									})}
								ai={isPriority && (ai.priority[thread.id]?.value ?? 0) >= IMPORTANT_THRESHOLD
									? priorityBadge
									: undefined}
							/>
						</SwipeRow>
					{/snippet}
				</MailRows>
			{/key}
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
