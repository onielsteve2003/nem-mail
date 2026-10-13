<script lang="ts">
	import { afterNavigate, goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { parseQuery, queryTerms, type Label, type ThreadSummary } from '@nem/shared';
	import SemanticToggle from '#features/search/SemanticToggle.svelte';
	import { semanticUrl, SEMANTIC_PARAM } from '#features/search/search-url.js';
	import { getAIService } from '#lib/ai/service.svelte.js';
	import MailRow from '#features/mail-list/MailRow.svelte';
	import MailRows from '#features/mail-list/MailRows.svelte';
	import SearchResults from '#features/search/SearchResults.svelte';
	import SearchScreen from '#features/search/SearchScreen.svelte';
	import { searchUrl } from '#features/search/search-url.js';
	import { getRepositories } from '#lib/data/provider.js';
	import { getMailboxStore } from '#lib/stores/mailbox.svelte.js';
	import { getSessionStore } from '#lib/stores/session.svelte.js';

	const TITLE = 'Search';

	const repos = getRepositories();
	const session = getSessionStore();
	const mailbox = getMailboxStore();
	const ai = getAIService();
	const SEMANTIC_MODEL = 'minilm';
	let labels = $state<Label[]>([]);

	const query = $derived(page.url.searchParams.get('q')?.trim() ?? '');
	const terms = $derived(queryTerms(parseQuery(query)));
	// Semantic search (AI-7) is a URL flag, so back and forward keep the mode.
	const canUseSemantic = $derived(ai.isEnabled('semanticSearch'));
	const isSemantic = $derived(canUseSemantic && page.url.searchParams.get(SEMANTIC_PARAM) === '1');
	const semanticModel = $derived(
		ai.models[SEMANTIC_MODEL] ?? {
			status: 'unknown' as const,
			progress: 0,
			error: null
		}
	);
	const isSemanticReady = $derived(isSemantic && semanticModel.status === 'ready');
	const labelsById = $derived(new Map(labels.map((l) => [l.id, l])));
	const threads = $derived(Object.values(mailbox.lists).flatMap((list) => list.items));

	$effect(() => {
		if (!session.user) return;
		// The Label chip just hides until labels arrive; a failure leaves it hidden.
		repos.labels.list().then(
			(list) => (labels = list),
			() => (labels = [])
		);
	});

	// Learns whether MiniLM is downloaded once the user asks for semantic search.
	$effect(() => {
		if (isSemantic) void ai.refresh().catch(() => {});
	});

	function setSemantic(isOn: boolean): void {
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- the current resolved /search path with a flag swapped
		void goto(semanticUrl(page.url, isOn), { replaceState: true });
	}

	/**
	 * Keyword search, then (in semantic mode with MiniLM downloaded) the hybrid ranking.
	 * Operator queries are only reranked; plain text can also find mail by meaning.
	 */
	async function runSearch(text: string, cursor?: string) {
		const user = session.user;
		if (!isSemanticReady || !user) return repos.search.search({ q: text, cursor });
		const parsed = parseQuery(text);
		const allowNew = parsed.clauses.every((c) => c.kind === 'text' && !c.negated);
		const keyword = await repos.search
			.search({ q: text, limit: 100 })
			.catch(() => ({ items: [], nextCursor: null }));
		const words = queryTerms(parsed).join(' ') || text;
		const ranked = await ai.semanticSearch(user.id, words, keyword.items, allowNew);
		return ranked ? { items: ranked, nextCursor: null } : keyword;
	}

	// Opened from inside the app: back returns there. A deep link has nowhere to go back to.
	let cameFromApp = false;
	afterNavigate(({ from }) => {
		if (from && from.url.pathname !== page.url.pathname) cameFromApp = true;
	});

	function back(): void {
		if (cameFromApp) history.back();
		else void goto(resolve('/mail/(list)/[mailbox]', { mailbox: 'inbox' }), { replaceState: true });
	}

	function rowLabels(thread: ThreadSummary): Label[] {
		return thread.labelIds.flatMap((id) => labelsById.get(id) ?? []);
	}

	function submit(q: string): void {
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- the current resolved /search path with ?q= swapped
		void goto(searchUrl(page.url, q), { replaceState: true });
	}
</script>

<svelte:head>
	<title>{query ? `${query} · ${TITLE}` : TITLE} · Nem Mail</title>
</svelte:head>

<main class="screen">
	{#if session.user}
		<SearchScreen
			{query}
			userId={session.user.id}
			{threads}
			{labels}
			searchContacts={(q) => repos.contacts.search({ q })}
			onsubmit={submit}
			onback={back}
		>
			{#snippet results(q)}
				{#if canUseSemantic}
					<SemanticToggle
						isOn={isSemantic}
						model={semanticModel}
						onchange={setSemantic}
						ondownload={() => void ai.download(SEMANTIC_MODEL)}
					/>
				{/if}
				{#key isSemanticReady}
					<SearchResults query={q} search={runSearch}>
						{#snippet list(results)}
							<MailRows
								items={results.items}
								hasMore={results.hasMore}
								isLoadingMore={results.isLoadingMore}
								onloadmore={results.loadMore}
							>
								{#snippet row(thread)}
									<MailRow
										{thread}
										href={resolve('/mail/thread/[threadId]', { threadId: thread.id })}
										labels={rowLabels(thread)}
										selfEmail={session.user?.email}
										highlight={terms}
									/>
								{/snippet}
							</MailRows>
						{/snippet}
					</SearchResults>
				{/key}
			{/snippet}
		</SearchScreen>
	{/if}
</main>

<style>
	.screen {
		min-block-size: var(--nm-viewport-height);
		padding-block-end: var(--nm-safe-bottom);
	}
</style>
