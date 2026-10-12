<script lang="ts">
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import History from '@lucide/svelte/icons/history';
	import Search from '@lucide/svelte/icons/search';
	import X from '@lucide/svelte/icons/x';
	import type { Contact, ThreadSummary } from '@nem/shared';
	import { onMount, type Snippet } from 'svelte';
	import Avatar from '#components/ui/Avatar.svelte';
	import Button from '#components/ui/Button.svelte';
	import Icon from '#components/ui/Icon.svelte';
	import IconButton from '#components/ui/IconButton.svelte';
	import SearchField from '#components/ui/SearchField.svelte';
	import SectionHeader from '#components/ui/SectionHeader.svelte';
	import { addRecent, loadRecent, saveRecent } from './recent.js';
	import { fromQuery, subjectQuery, subjectSuggestions } from './suggestions.js';

	const SEARCH_DEBOUNCE_MS = 150;
	const CONTACT_LIMIT = 4;
	const COPY = {
		label: 'Search in mail',
		back: 'Back',
		recent: 'Recent searches',
		clearAll: 'Clear all',
		remove: (q: string) => `Remove "${q}" from recent searches`,
		contacts: 'People',
		subjects: 'Subjects',
		searchFor: (q: string) => `Search for "${q}"`
	};

	interface Props {
		/** The submitted query from the URL; '' before any search. */
		query: string;
		/** Signed-in account, so recent searches stay per account. */
		userId: string;
		/** Threads already loaded in the app, for subject suggestions. */
		threads: ThreadSummary[];
		searchContacts: (q: string) => Promise<Contact[]>;
		onsubmit: (query: string) => void;
		onback: () => void;
		/** Shown once a query is submitted and the field still holds it. */
		results?: Snippet<[string]>;
		storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
	}

	let {
		query,
		userId,
		threads,
		searchContacts,
		onsubmit,
		onback,
		results,
		storage = typeof localStorage === 'undefined' ? undefined : localStorage
	}: Props = $props();

	// Seeded from the URL once; the URL follows the field on submit, not the other way round.
	let text = $state((() => query)());
	// Reloads when the account changes; edits write through to storage.
	let recent = $derived(loadRecent(storage, userId));
	let contacts = $state<Contact[]>([]);
	let field: HTMLDivElement;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let request = 0;

	const typed = $derived(text.trim());
	const showResults = $derived(query !== '' && typed === query);
	const subjects = $derived(showResults ? [] : subjectSuggestions(threads, typed));

	onMount(() => {
		// The pill grows in from the list's search bar (shared view-transition-name); then type.
		field.querySelector('input')?.focus();
		return () => clearTimeout(timer);
	});

	function lookup() {
		clearTimeout(timer);
		const q = typed;
		const current = ++request;
		if (!q || q.includes(':')) {
			contacts = [];
			return;
		}
		timer = setTimeout(async () => {
			const found = await searchContacts(q).catch(() => [] as Contact[]);
			if (current === request) contacts = found.slice(0, CONTACT_LIMIT);
		}, SEARCH_DEBOUNCE_MS);
	}

	function submit(value: string) {
		const q = value.trim().replace(/\s+/g, ' ');
		if (!q) return;
		text = q;
		contacts = [];
		recent = addRecent(recent, q);
		saveRecent(storage, userId, recent);
		(document.activeElement as HTMLElement | null)?.blur();
		onsubmit(q);
	}

	function removeRecent(q: string) {
		recent = recent.filter((item) => item !== q);
		saveRecent(storage, userId, recent);
	}

	function clearRecent() {
		recent = [];
		saveRecent(storage, userId, recent);
	}
</script>

<div class="search-screen">
	<form
		class="bar"
		role="search"
		onsubmit={(event) => {
			event.preventDefault();
			submit(text);
		}}
	>
		<div class="pill" bind:this={field}>
			<IconButton icon={ArrowLeft} label={COPY.back} onclick={onback} />
			<SearchField
				class="field"
				label={COPY.label}
				bind:value={text}
				oninput={lookup}
				onclear={() => (contacts = [])}
			/>
		</div>
	</form>

	{#if showResults}
		{@render results?.(query)}
	{:else if typed}
		<div class="panel">
			<ul class="list">
				<li>
					<button type="button" class="row" onclick={() => submit(text)}>
						<span class="row__icon"><Icon icon={Search} /></span>
						<span class="row__text">{COPY.searchFor(typed)}</span>
					</button>
				</li>
			</ul>
			{#if contacts.length}
				<SectionHeader title={COPY.contacts} level={2} />
				<ul class="list">
					{#each contacts as contact (contact.email)}
						<li>
							<button type="button" class="row" onclick={() => submit(fromQuery(contact.email))}>
								<Avatar name={contact.name ?? contact.email} size="sm" />
								<span class="row__text">
									<span>{contact.name ?? contact.email}</span>
									{#if contact.name}<span class="row__sub">{contact.email}</span>{/if}
								</span>
							</button>
						</li>
					{/each}
				</ul>
			{/if}
			{#if subjects.length}
				<SectionHeader title={COPY.subjects} level={2} />
				<ul class="list">
					{#each subjects as subject (subject)}
						<li>
							<button type="button" class="row" onclick={() => submit(subjectQuery(subject))}>
								<span class="row__icon"><Icon icon={Search} /></span>
								<span class="row__text">{subject}</span>
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	{:else if recent.length}
		<div class="panel">
			<SectionHeader title={COPY.recent} level={2}>
				{#snippet action()}
					<Button variant="ghost" size="sm" onclick={clearRecent}>{COPY.clearAll}</Button>
				{/snippet}
			</SectionHeader>
			<ul class="list">
				{#each recent as q (q)}
					<li class="recent">
						<button type="button" class="row" onclick={() => submit(q)}>
							<span class="row__icon"><Icon icon={History} /></span>
							<span class="row__text">{q}</span>
						</button>
						<IconButton icon={X} label={COPY.remove(q)} onclick={() => removeRecent(q)} />
					</li>
				{/each}
			</ul>
		</div>
	{/if}
</div>

<style>
	.bar {
		position: sticky;
		inset-block-start: 0;
		z-index: var(--nm-z-sticky);
		padding-block: calc(var(--nm-safe-top) + var(--nm-space-2)) var(--nm-space-2);
		padding-inline: max(var(--nm-space-3), var(--nm-safe-left))
			max(var(--nm-space-3), var(--nm-safe-right));
	}
	.pill {
		display: flex;
		align-items: center;
		gap: var(--nm-space-1);
		padding: var(--nm-space-1);
		border: 1px solid var(--nm-color-border);
		border-radius: var(--nm-radius-pill);
		background: var(--nm-color-glass);
		backdrop-filter: blur(16px) saturate(1.4);
		-webkit-backdrop-filter: blur(16px) saturate(1.4);
		box-shadow: var(--nm-shadow-2);
		/* Same name as the list's SearchBar, so the page transition morphs one into the other. */
		view-transition-name: nm-search-bar;
	}
	.pill :global(.field) {
		flex: 1;
		min-inline-size: 0;
		padding-inline-start: var(--nm-space-2);
		background: none;
	}
	.panel {
		padding-inline: max(var(--nm-space-2), var(--nm-safe-left))
			max(var(--nm-space-2), var(--nm-safe-right));
		padding-block-end: var(--nm-safe-bottom);
	}
	.list {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.recent {
		display: flex;
		align-items: center;
	}
	.row {
		flex: 1;
		display: flex;
		align-items: center;
		gap: var(--nm-space-3);
		inline-size: 100%;
		min-block-size: var(--nm-size-touch);
		padding: var(--nm-space-2) var(--nm-space-3);
		border: 0;
		border-radius: var(--nm-radius-md);
		background: none;
		color: var(--nm-color-text);
		font: inherit;
		text-align: start;
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
	}
	.row:hover {
		background: var(--nm-color-surface-2);
	}
	.row__icon {
		display: inline-grid;
		place-items: center;
		inline-size: var(--nm-size-avatar-sm);
		color: var(--nm-color-text-muted);
	}
	.row__text {
		display: flex;
		flex-direction: column;
		min-inline-size: 0;
		overflow-wrap: anywhere;
	}
	.row__sub {
		color: var(--nm-color-text-muted);
		font-size: var(--nm-text-caption);
	}
</style>
