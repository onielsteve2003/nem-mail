<script lang="ts" module>
	import type { Page, ThreadSummary } from '@nem/shared';

	/** What the results hand the list snippet. */
	export interface ResultsList {
		items: ThreadSummary[];
		hasMore: boolean;
		isLoadingMore: boolean;
		loadMore: () => void;
	}
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import EmptyState from '#components/ui/EmptyState.svelte';
	import ErrorState from '#components/ui/ErrorState.svelte';
	import Skeleton from '#components/ui/Skeleton.svelte';
	import { errorMessage } from '#lib/utils/errors.js';

	const SKELETON_ROWS = 6;
	const COPY = {
		loading: 'Searching',
		error: "Couldn't search",
		empty: 'No results',
		emptyMessage: (q: string) => `Nothing matches "${q}". Try fewer words or remove a filter.`,
		count: (n: number, more: boolean) =>
			`${n}${more ? '+' : ''} ${n === 1 && !more ? 'result' : 'results'}`
	};

	interface Props {
		query: string;
		search: (q: string, cursor?: string) => Promise<Page<ThreadSummary>>;
		/** Renders the rows (the route passes MailRows with highlighted MailRow). */
		list: Snippet<[ResultsList]>;
	}

	let { query, search, list }: Props = $props();

	let items = $state<ThreadSummary[]>([]);
	let nextCursor = $state<string | null>(null);
	let status = $state<'loading' | 'error' | 'ready'>('loading');
	let error = $state('');
	let isLoadingMore = $state(false);
	let request = 0;

	// A new query starts over; answers to an older query are dropped.
	$effect(() => {
		void load(query);
	});

	async function load(q: string) {
		const current = ++request;
		status = 'loading';
		isLoadingMore = false;
		try {
			const page = await search(q);
			if (current !== request) return;
			items = page.items;
			nextCursor = page.nextCursor;
			status = 'ready';
		} catch (e) {
			if (current !== request) return;
			error = errorMessage(e, COPY.error);
			status = 'error';
		}
	}

	async function loadMore() {
		if (isLoadingMore || !nextCursor) return;
		const current = request;
		isLoadingMore = true;
		try {
			const page = await search(query, nextCursor);
			if (current !== request) return;
			const seen = new Set(items.map((t) => t.id));
			items = [...items, ...page.items.filter((t) => !seen.has(t.id))];
			nextCursor = page.nextCursor;
		} catch {
			// Keep what is shown; the sentinel retries on the next scroll.
		} finally {
			if (current === request) isLoadingMore = false;
		}
	}
</script>

<section class="results" aria-busy={status === 'loading'}>
	{#if status === 'loading'}
		<span class="nm-visually-hidden" role="status">{COPY.loading}</span>
		{#each { length: SKELETON_ROWS }, index (index)}
			<div class="skeleton" aria-hidden="true">
				<Skeleton shape="circle" width="var(--nm-size-avatar-md)" />
				<Skeleton lines={3} class="skeleton__text" />
			</div>
		{/each}
	{:else if status === 'error'}
		<ErrorState title={COPY.error} message={error} onretry={() => void load(query)} />
	{:else if items.length === 0}
		<EmptyState title={COPY.empty} message={COPY.emptyMessage(query)} illustration="search" />
	{:else}
		<p class="count nm-text-caption" role="status">
			{COPY.count(items.length, nextCursor !== null)}
		</p>
		{@render list({ items, hasMore: nextCursor !== null, isLoadingMore, loadMore })}
	{/if}
</section>

<style>
	.results {
		padding-inline: max(var(--nm-space-2), var(--nm-safe-left))
			max(var(--nm-space-2), var(--nm-safe-right));
	}
	.count {
		margin: 0;
		padding: var(--nm-space-1) var(--nm-space-3);
		color: var(--nm-color-text-muted);
	}
	.skeleton {
		display: flex;
		gap: var(--nm-space-3);
		padding: var(--nm-space-3) var(--nm-space-4);
	}
	.skeleton :global(.skeleton__text) {
		flex: 1;
	}
</style>
