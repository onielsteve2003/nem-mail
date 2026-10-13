<script lang="ts">
	import type { Label, Message, Thread, ThreadOp } from '@nem/shared';
	import { untrack } from 'svelte';
	import EmptyState from '#components/ui/EmptyState.svelte';
	import ErrorState from '#components/ui/ErrorState.svelte';
	import Skeleton from '#components/ui/Skeleton.svelte';
	import ThreadActions from '#components/ui/ThreadActions.svelte';
	import { getAIService } from '#lib/ai/service.svelte.js';
	import { IMPORTANT_THRESHOLD } from '#lib/ai/models/priority-lr.js';
	import type { SpamVerdict } from '#lib/ai/models/spam-nb.js';
	import type { SummaryVerdict } from '#lib/ai/models/textrank.js';
	import { getRepositories } from '#lib/data/provider.js';
	import { getMailboxStore } from '#lib/stores/mailbox.svelte.js';
	import { getSessionStore } from '#lib/stores/session.svelte.js';
	import { getThreadStore } from '#lib/stores/thread.svelte.js';
	import { toastStore } from '#lib/stores/toast.svelte.js';
	import { getUiStore } from '#lib/stores/ui.svelte.js';
	import { errorMessage, toAppError } from '#lib/utils/errors.js';
	import MessageList from './MessageList.svelte';
	import SpamBanner from './SpamBanner.svelte';
	import SummaryCard from './SummaryCard.svelte';
	import ThreadHeader from './ThreadHeader.svelte';
	import { leavesThread } from './actions.js';
	import {
		scrollsSideways,
		swipeTarget,
		threadNeighbors,
		threadShortcut,
		type ThreadShortcut
	} from './thread-nav.js';
	import { mayNeedSummary } from './summary.js';
	import { threadViewState } from './view-state.js';

	const LOADING = 'Loading conversation';
	const NOT_FOUND_TITLE = 'Conversation not found';
	const NOT_FOUND_MESSAGE = 'It may have been deleted, or the link is wrong.';
	const ERROR_TITLE = "Couldn't open this conversation";
	const SCHEDULE_CANCELLED = 'Schedule cancelled. Moved to Drafts.';
	const ALREADY_SENT = 'Too late to cancel. The message was sent.';
	const CANCEL_FAILED = "Couldn't cancel the scheduled send";

	interface Props {
		threadId: string;
		/** Back arrow on the full-screen route, X in the reading pane. */
		variant?: 'back' | 'close';
		onclose: () => void;
		/** Opens another thread in place (swipe, j/k), replacing this one in history. */
		onnavigate?: (threadId: string) => void;
	}

	let { threadId, variant = 'back', onclose, onnavigate }: Props = $props();

	const repos = getRepositories();
	const session = getSessionStore();
	const threads = getThreadStore();
	const mailbox = getMailboxStore();
	const ui = getUiStore();
	const ai = getAIService();

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
		// AI-6 learns from opens (a light signal next to marking important).
		const user = session.user;
		const opened = thread;
		if (user && opened.mailboxes.includes('inbox')) {
			untrack(() =>
				ai
					.learnPriority(user, [opened], true, 'open')
					.catch((error: unknown) => console.error('Priority learning failed', error))
			);
		}
	});

	// AI-6: explain an Important marker the model agrees with.
	$effect(() => {
		const user = session.user;
		if (!user || !thread?.isImportant || !ai.isEnabled('priority')) return;
		const current = thread;
		untrack(() =>
			ai
				.scorePriority(user, [current])
				.catch((error: unknown) => console.error('Priority scoring failed', error))
		);
	});
	const importance = $derived.by(() => {
		const verdict = thread ? ai.priority[thread.id] : undefined;
		return verdict && verdict.value >= IMPORTANT_THRESHOLD ? verdict : null;
	});

	// AI-2: in Spam, explain the verdict for the latest message someone else sent.
	const spamMessage = $derived.by(() => {
		if (!thread?.mailboxes.includes('spam') || !ai.isEnabled('spam')) return null;
		const self = session.user?.email.toLowerCase();
		return thread.messages.findLast((m) => m.from.email.toLowerCase() !== self) ?? null;
	});
	let spamCheck = $state<{ id: string; verdict: SpamVerdict | null; error: unknown }>({
		id: '',
		verdict: null,
		error: null
	});
	function checkSpam(message: Message): void {
		const userId = session.user?.id;
		if (!userId) return;
		spamCheck = { id: message.id, verdict: null, error: null };
		ai.classifySpam(userId, message).then(
			(verdict) => {
				if (spamCheck.id === message.id) spamCheck.verdict = verdict;
			},
			(error: unknown) => {
				if (spamCheck.id === message.id) spamCheck.error = error;
			}
		);
	}
	$effect(() => {
		const message = spamMessage;
		if (message) untrack(() => checkSpam(message));
	});

	// AI-3: a summary card on threads long enough to need one (Spam shows its banner instead).
	const summaryKey = $derived(
		thread && !spamMessage && ai.isEnabled('summary')
			? `${thread.id}:${thread.messages.length}`
			: null
	);
	let summary = $state<{ key: string; verdict: SummaryVerdict | null; error: boolean }>({
		key: '',
		verdict: null,
		error: false
	});
	let dismissedSummary = $state<string | null>(null);
	function summarize(key: string, current: Thread): void {
		const self = session.user?.email ?? '';
		summary = { key, verdict: null, error: false };
		ai.summarize(current, self).then(
			(verdict) => {
				if (summary.key === key) summary.verdict = verdict;
			},
			() => {
				if (summary.key === key) summary.error = true;
			}
		);
	}
	$effect(() => {
		const key = summaryKey;
		const current = thread;
		if (key && current) untrack(() => summarize(key, current));
	});
	const isSummaryLoading = $derived(
		summary.key !== summaryKey || (!summary.verdict && !summary.error)
	);
	// Loading shows only where a summary is likely, so short mail never flashes a card.
	const showSummary = $derived(
		!!thread &&
			summaryKey !== null &&
			dismissedSummary !== summaryKey &&
			(isSummaryLoading ? mayNeedSummary(thread) : !!summary.verdict || summary.error)
	);

	function act(op: ThreadOp | ThreadOp[]): void {
		if (!thread) return;
		const ops = Array.isArray(op) ? op : [op];
		void mailbox.apply([thread.id], ops);
		if (ops.some(leavesThread)) onclose();
	}

	function deleteForever(): void {
		if (!thread) return;
		void mailbox.deleteForever([thread.id]);
		onclose();
	}

	async function createLabel(name: string): Promise<Label> {
		const label = await repos.labels.create({ name, color: 'neutral', parentId: null });
		labels = [...labels, label];
		ui.labelsChanged();
		return label;
	}

	/**
	 * Cancels a scheduled message (FR-5.7): it becomes a draft again and opens in
	 * compose. A thread that held only that message is gone, so the view closes.
	 */
	async function cancelSend(message: Message): Promise<void> {
		const isLast = thread?.messages.length === 1;
		try {
			const draft = await repos.drafts.cancelSend(message.id);
			mailbox.invalidate();
			ui.draftsChanged();
			toastStore.show({ message: SCHEDULE_CANCELLED });
			if (isLast) onclose();
			else void threads.load(message.threadId, { refresh: true });
			ui.openCompose({
				mode: draft.mode,
				threadId: draft.threadId,
				messageId: draft.inReplyTo,
				draftId: draft.id
			});
		} catch (error) {
			const isSent = toAppError(error).code === 'CONFLICT';
			toastStore.show({ message: isSent ? ALREADY_SENT : CANCEL_FAILED, tone: 'error' });
			if (isSent) void threads.load(message.threadId, { refresh: true });
		}
	}

	// Neighbors come from the list the thread was opened from (FR-4.6).
	const neighbors = $derived.by(() => {
		const list = mailbox.activeKey ? mailbox.lists[mailbox.activeKey] : undefined;
		return threadNeighbors(list?.items.map((item) => item.id) ?? [], threadId);
	});

	function go(direction: 'older' | 'newer'): void {
		const id = neighbors[direction];
		if (id && onnavigate) onnavigate(id);
	}

	function run(shortcut: ThreadShortcut): void {
		if (shortcut === 'older' || shortcut === 'newer') go(shortcut);
		else if (shortcut === 'archive') act({ op: 'archive' });
		else if (shortcut === 'trash') act({ op: 'trash' });
		else {
			const last = thread?.messages.at(-1);
			if (last) ui.openCompose({ mode: 'reply', threadId: last.threadId, messageId: last.id });
		}
	}

	function onkeydown(event: KeyboardEvent): void {
		// Sheets and the drawer own the keyboard while open.
		if (!thread || ui.activeSheet || ui.isDrawerOpen || event.defaultPrevented) return;
		const shortcut = threadShortcut(event);
		if (!shortcut) return;
		event.preventDefault();
		run(shortcut);
	}

	let swipeStart: { x: number; y: number } | null = null;
	function ontouchstart(event: TouchEvent & { currentTarget: HTMLElement }): void {
		const touch = event.touches[0];
		const sideways = scrollsSideways(event.target as Element, event.currentTarget);
		swipeStart =
			event.touches.length === 1 && touch && !sideways
				? { x: touch.clientX, y: touch.clientY }
				: null;
	}
	function ontouchend(event: TouchEvent): void {
		const touch = event.changedTouches[0];
		if (!swipeStart || !touch) return;
		const target = swipeTarget(touch.clientX - swipeStart.x, touch.clientY - swipeStart.y);
		swipeStart = null;
		if (target) go(target);
	}

	const threadLabels = $derived(
		thread ? labels.filter((label) => thread.labelIds.includes(label.id)) : []
	);
</script>

<svelte:window {onkeydown} />

<article
	class="thread"
	aria-busy={view === 'loading'}
	aria-keyshortcuts="j k e # r"
	{ontouchstart}
	{ontouchend}
	ontouchcancel={() => (swipeStart = null)}
>
	<ThreadHeader
		subject={thread?.subject ?? null}
		labels={threadLabels}
		isImportant={thread?.isImportant}
		{importance}
		{variant}
		{onclose}
	>
		{#snippet actions()}
			{#if thread}
				<ThreadActions
					threads={[thread]}
					{labels}
					onapply={act}
					oncreatelabel={createLabel}
					ondeleteforever={deleteForever}
					readInBar
				/>
			{/if}
		{/snippet}
	</ThreadHeader>

	{#if thread}
		<!-- Keyed so another thread starts with its own messages open. -->
		{#if spamMessage}
			<SpamBanner
				verdict={spamCheck.id === spamMessage.id ? spamCheck.verdict : null}
				isLoading={spamCheck.id !== spamMessage.id || (!spamCheck.verdict && !spamCheck.error)}
				error={spamCheck.error ? errorMessage(spamCheck.error) : null}
				onretry={() => spamMessage && checkSpam(spamMessage)}
				onnotspam={() => act({ op: 'notSpam' })}
			/>
		{/if}
		{#if showSummary && summaryKey}
			<SummaryCard
				verdict={isSummaryLoading ? null : summary.verdict}
				isLoading={isSummaryLoading}
				error={!isSummaryLoading && summary.error}
				onretry={() => summaryKey && summarize(summaryKey, thread)}
				ondismiss={() => (dismissedSummary = summaryKey)}
			/>
		{/if}
		{#key thread.id}
			<MessageList
				messages={thread.messages}
				selfEmail={session.user?.email}
				loadAttachment={(id) => repos.mail.getAttachment(id)}
				oncompose={(mode, message) =>
					ui.openCompose({ mode, threadId: message.threadId, messageId: message.id })}
				oncancelsend={(message) => void cancelSend(message)}
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
