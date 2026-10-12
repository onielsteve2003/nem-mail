<script lang="ts">
	import CalendarClock from '@lucide/svelte/icons/calendar-clock';
	import CalendarX from '@lucide/svelte/icons/calendar-x';
	import Copy from '@lucide/svelte/icons/copy';
	import EllipsisVertical from '@lucide/svelte/icons/ellipsis-vertical';
	import Forward from '@lucide/svelte/icons/forward';
	import Reply from '@lucide/svelte/icons/reply';
	import ReplyAll from '@lucide/svelte/icons/reply-all';
	import type { ComposeMode, Message } from '@nem/shared';
	import ActionSheet, { type ActionSheetItem } from '#components/ui/ActionSheet.svelte';
	import Button from '#components/ui/Button.svelte';
	import Icon from '#components/ui/Icon.svelte';
	import IconButton from '#components/ui/IconButton.svelte';
	import { toastStore } from '#lib/stores/toast.svelte.js';
	import { canReplyAll, fullTime } from './messages.js';

	const COPY = {
		reply: 'Reply',
		replyAll: 'Reply all',
		forward: 'Forward',
		more: 'More message actions',
		copyText: 'Copy text',
		copied: 'Message text copied',
		copyFailed: "Couldn't copy the text",
		scheduledFor: (when: string) => `Sends ${when}`,
		cancelSend: 'Cancel send'
	};

	interface Props {
		message: Message;
		selfEmail?: string;
		oncompose: (mode: Exclude<ComposeMode, 'new'>, message: Message) => void;
		/** Cancels a scheduled message (FR-5.7); it goes back to Drafts. */
		oncancelsend?: (message: Message) => void;
	}

	let { message, selfEmail, oncompose, oncancelsend }: Props = $props();

	let isMoreOpen = $state(false);
	const showReplyAll = $derived(canReplyAll(message, selfEmail));

	const more = $derived<ActionSheetItem[]>([
		{ label: COPY.reply, icon: Reply, onselect: () => oncompose('reply', message) },
		...(showReplyAll
			? [{ label: COPY.replyAll, icon: ReplyAll, onselect: () => oncompose('replyAll', message) }]
			: []),
		{ label: COPY.forward, icon: Forward, onselect: () => oncompose('forward', message) },
		{ label: COPY.copyText, icon: Copy, onselect: () => void copyText() }
	]);

	async function copyText(): Promise<void> {
		try {
			await navigator.clipboard.writeText(message.bodyText);
			toastStore.show({ message: COPY.copied });
		} catch {
			toastStore.show({ message: COPY.copyFailed, tone: 'error' });
		}
	}
</script>

{#if message.status === 'scheduled' && oncancelsend}
	<div class="scheduled" role="note">
		<Icon icon={CalendarClock} size="sm" />
		<span class="scheduled__text nm-text-caption">
			{COPY.scheduledFor(fullTime(message.sendAt ?? message.sentAt))}
		</span>
		<Button variant="glass" size="sm" onclick={() => oncancelsend(message)}>
			{#snippet leading()}<Icon icon={CalendarX} size="sm" />{/snippet}
			{COPY.cancelSend}
		</Button>
	</div>
{:else}
	<div class="actions">
		<Button variant="glass" size="sm" onclick={() => oncompose('reply', message)}>
			{#snippet leading()}<Icon icon={Reply} size="sm" />{/snippet}
			{COPY.reply}
		</Button>
		{#if showReplyAll}
			<Button variant="glass" size="sm" onclick={() => oncompose('replyAll', message)}>
				{#snippet leading()}<Icon icon={ReplyAll} size="sm" />{/snippet}
				{COPY.replyAll}
			</Button>
		{/if}
		<Button variant="glass" size="sm" onclick={() => oncompose('forward', message)}>
			{#snippet leading()}<Icon icon={Forward} size="sm" />{/snippet}
			{COPY.forward}
		</Button>
		<IconButton
			class="actions__more"
			icon={EllipsisVertical}
			label={COPY.more}
			size="sm"
			aria-haspopup="dialog"
			onclick={() => (isMoreOpen = true)}
		/>
	</div>
{/if}

<ActionSheet
	open={isMoreOpen}
	title={COPY.more}
	hideTitle
	actions={more}
	onclose={() => (isMoreOpen = false)}
/>

<style>
	.scheduled {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--nm-space-2);
		margin: 0 var(--nm-space-4) var(--nm-space-5);
		padding: var(--nm-space-2) var(--nm-space-3);
		border: 1px solid var(--nm-color-border);
		border-radius: var(--nm-radius-md);
		color: var(--nm-color-text-muted);
	}
	.scheduled__text {
		flex: 1;
		min-inline-size: 0;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--nm-space-2);
		padding: 0 var(--nm-space-4) var(--nm-space-5);
	}
	.actions :global(.actions__more) {
		margin-inline-start: auto;
	}
</style>
