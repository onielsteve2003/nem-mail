<script lang="ts">
	import Pencil from '@lucide/svelte/icons/pencil';
	import type { Draft } from '@nem/shared';
	import EmptyState from '#components/ui/EmptyState.svelte';
	import ErrorState from '#components/ui/ErrorState.svelte';
	import Icon from '#components/ui/Icon.svelte';
	import Skeleton from '#components/ui/Skeleton.svelte';
	import { getRepositories } from '#lib/data/provider.js';
	import { getSessionStore } from '#lib/stores/session.svelte.js';
	import { getUiStore } from '#lib/stores/ui.svelte.js';
	import { errorMessage } from '#lib/utils/errors.js';
	import { listTime } from './format.js';
	import { draftRecipients, draftSnippet } from './drafts.js';
	import { emptyCopy, errorCopy } from './list-states.js';
	import { getListRefresh } from './refresh.js';

	const TITLE = 'Drafts';
	const DRAFT = 'Draft';
	const NO_SUBJECT = '(no subject)';
	const LOADING = 'Loading drafts';
	const SKELETON_ROWS = 4;

	const repos = getRepositories();
	const session = getSessionStore();
	const ui = getUiStore();

	let drafts = $state<Draft[] | null>(null);
	let failure = $state<string | null>(null);

	async function load(): Promise<void> {
		try {
			drafts = await repos.drafts.list();
			failure = null;
		} catch (error) {
			if (!drafts) failure = errorMessage(error);
		}
	}

	$effect(() => {
		if (!session.user) return;
		drafts = null;
		failure = null;
		void load();
	});

	const listRefresh = getListRefresh();
	$effect(() => listRefresh.register(load));

	const empty = emptyCopy('drafts');
	const errorState = errorCopy(false);
	const now = Date.now();
</script>

<section class="list" aria-labelledby="list-heading">
	<h1 id="list-heading" class="list__title nm-text-label">{TITLE}</h1>
	{#if failure}
		<ErrorState
			title={errorState.title}
			message={failure}
			illustration={errorState.illustration}
			onretry={() => {
				failure = null;
				void load();
			}}
		/>
	{:else if !drafts}
		<div role="status" aria-label={LOADING}>
			{#each { length: SKELETON_ROWS }, index (index)}
				<Skeleton lines={3} class="draft-skeleton" />
			{/each}
		</div>
	{:else if drafts.length === 0}
		<EmptyState title={empty.title} message={empty.message} illustration={empty.illustration} />
	{:else}
		<ul class="drafts">
			{#each drafts as draft (draft.id)}
				<li>
					<button
						type="button"
						class="draft"
						onclick={() =>
							ui.openCompose({
								mode: draft.mode,
								threadId: draft.threadId,
								messageId: draft.inReplyTo,
								draftId: draft.id
							})}
					>
						<span class="draft__line">
							<span class="draft__tag"><Icon icon={Pencil} size="sm" />{DRAFT}</span>
							<span class="draft__to nm-text-truncate">{draftRecipients(draft)}</span>
							<time class="draft__time nm-text-numeric" datetime={draft.updatedAt}>
								{listTime(draft.updatedAt, now)}
							</time>
						</span>
						<span class="draft__subject nm-text-truncate">
							{draft.subject.trim() || NO_SUBJECT}
						</span>
						<span class="draft__snippet nm-text-truncate">{draftSnippet(draft.bodyHtml)}</span>
					</button>
				</li>
			{/each}
		</ul>
	{/if}
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
	.list :global(.draft-skeleton) {
		padding-block: var(--nm-space-3);
		padding-inline: var(--nm-space-4);
	}
	.drafts {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.draft {
		display: flex;
		flex-direction: column;
		gap: var(--nm-space-1);
		inline-size: 100%;
		padding-block: var(--nm-space-3);
		padding-inline: var(--nm-space-4);
		border: 0;
		border-radius: var(--nm-radius-lg);
		background: none;
		color: var(--nm-color-text-muted);
		font: inherit;
		font-size: var(--nm-text-body);
		text-align: start;
		cursor: pointer;
	}
	.draft:hover {
		background: var(--nm-color-surface-1);
	}
	.draft:focus-visible {
		outline: 2px solid var(--nm-color-focus);
		outline-offset: calc(-1 * var(--nm-space-1));
	}
	.draft__line {
		display: flex;
		align-items: center;
		gap: var(--nm-space-2);
		min-inline-size: 0;
	}
	.draft__tag {
		display: inline-flex;
		flex: none;
		align-items: center;
		gap: var(--nm-space-1);
		color: var(--nm-color-danger);
		font-weight: var(--nm-weight-semibold);
	}
	.draft__to,
	.draft__subject {
		color: var(--nm-color-text);
	}
	.draft__time {
		flex: none;
		margin-inline-start: auto;
		font-size: var(--nm-text-caption);
	}
	.draft__snippet {
		color: var(--nm-color-text-subtle);
	}
</style>
