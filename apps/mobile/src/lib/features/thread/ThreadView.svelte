<script lang="ts">
	import type { Label, ThreadOp } from '@nem/shared';
	import { untrack } from 'svelte';
	import EmptyState from '#components/ui/EmptyState.svelte';
	import ErrorState from '#components/ui/ErrorState.svelte';
	import Skeleton from '#components/ui/Skeleton.svelte';
	import ThreadActions from '#components/ui/ThreadActions.svelte';
	import { getRepositories } from '#lib/data/provider.js';
	import { getMailboxStore } from '#lib/stores/mailbox.svelte.js';
	import { getSessionStore } from '#lib/stores/session.svelte.js';
	import { getThreadStore } from '#lib/stores/thread.svelte.js';
	import { errorMessage } from '#lib/utils/errors.js';
	import MessageList from './MessageList.svelte';
	import ThreadHeader from './ThreadHeader.svelte';
	import { leavesThread } from './actions.js';
	import { threadViewState } from './view-state.js';

	const LOADING = 'Loading conversation';
	const NOT_FOUND_TITLE = 'Conversation not found';
	const NOT_FOUND_MESSAGE = 'It may have been deleted, or the link is wrong.';
	const ERROR_TITLE = "Couldn't open this conversation";

	interface Props {
		threadId: string;
		/** Back arrow on the full-screen route, X in the reading pane. */
		variant?: 'back' | 'close';
		onclose: () => void;
	}

	let { threadId, variant = 'back', onclose }: Props = $props();

	const repos = getRepositories();
	const session = getSessionStore();
	const threads = getThreadStore();
	const mailbox = getMailboxStore();

	let labels = $state<Label[]>([]);
	// Labels name the pills; the thread still opens if they fail.
	$effect(() => {
		if (!session.user) return;
		repos.labels.list().then(
			(list) => (labels = list),
			() => {}
		);
	});

	$effect(() => {
		const id = threadId;
		untrack(() => void threads.load(id));
	});

	const entry = $derived(threads.get(threadId));
	const view = $derived(threadViewState(entry));
	const thread = $derived(entry?.thread ?? null);
	// Opening a thread reads it (FR-4.5). Once per open, so "Mark unread" is not undone at once.
	let markedId: string | null = null;
	$effect(() => {
		if (!thread || thread.id === markedId) return;
		markedId = thread.id;
		if (thread.isUnread) {
			const id = thread.id;
			untrack(() => void mailbox.apply([id], { op: 'markRead' }, { undoable: false }));
		}
	});

	function act(op: ThreadOp): void {
		if (!thread) return;
		void mailbox.apply([thread.id], op);
		if (leavesThread(op)) onclose();
	}

	const threadLabels = $derived(
		thread ? labels.filter((label) => thread.labelIds.includes(label.id)) : []
	);
</script>

<article class="thread" aria-busy={view === 'loading'}>
	<ThreadHeader
		subject={thread?.subject ?? null}
		labels={threadLabels}
		isImportant={thread?.isImportant}
		{variant}
		{onclose}
	>
		{#snippet actions()}
			{#if thread}
				<ThreadActions threads={[thread]} {labels} onapply={act} readInBar />
			{/if}
		{/snippet}
	</ThreadHeader>

	{#if thread}
		<!-- Keyed so another thread starts with its own messages open. -->
		{#key thread.id}
			<MessageList
				messages={thread.messages}
				selfEmail={session.user?.email}
				loadAttachment={(id) => repos.mail.getAttachment(id)}
			/>
		{/key}
	{:else if view === 'loading'}
		<div class="thread__skeleton" role="status" aria-label={LOADING}>
			<Skeleton width="70%" height="var(--nm-space-6)" />
			<div class="thread__skeleton-row">
				<Skeleton shape="circle" width="var(--nm-size-avatar-md)" />
				<Skeleton lines={2} class="thread__skeleton-text" />
			</div>
			<Skeleton lines={5} />
		</div>
	{:else if view === 'not-found'}
		<EmptyState title={NOT_FOUND_TITLE} message={NOT_FOUND_MESSAGE} illustration="search" />
	{:else if view === 'error'}
		<ErrorState
			title={ERROR_TITLE}
			message={errorMessage(entry?.error)}
			onretry={() => void threads.load(threadId)}
		/>
	{/if}
</article>

<style>
	.thread {
		display: flex;
		flex-direction: column;
		padding-block-start: var(--nm-space-2);
	}
	.thread__skeleton {
		display: flex;
		flex-direction: column;
		gap: var(--nm-space-4);
		padding-inline: var(--nm-space-4);
	}
	.thread__skeleton-row {
		display: flex;
		align-items: center;
		gap: var(--nm-space-3);
	}
	.thread__skeleton-row :global(.thread__skeleton-text) {
		flex: 1;
	}
</style>
