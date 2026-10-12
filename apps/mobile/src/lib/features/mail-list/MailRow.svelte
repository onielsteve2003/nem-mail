<script lang="ts" module>
	import type { DENSITIES } from '@nem/shared';

	export type MailRowDensity = (typeof DENSITIES)[number];
</script>

<script lang="ts">
	import Bookmark from '@lucide/svelte/icons/bookmark';
	import FileText from '@lucide/svelte/icons/file-text';
	import Image from '@lucide/svelte/icons/image';
	import Paperclip from '@lucide/svelte/icons/paperclip';
	import Star from '@lucide/svelte/icons/star';
	import type { Label, ThreadSummary } from '@nem/shared';
	import type { Snippet } from 'svelte';
	import Avatar from '#components/ui/Avatar.svelte';
	import Icon from '#components/ui/Icon.svelte';
	import LabelPill from '#components/ui/LabelPill.svelte';
	import { MAX_ATTACHMENT_CHIPS, listTime, senderLine, type RowText } from './format.js';
	import { longPress } from './long-press.js';
	import MarkToggle from './MarkToggle.svelte';

	const UNREAD = 'Unread';
	const STARRED = 'Starred';
	const IMPORTANT = 'Important';
	const HAS_ATTACHMENTS = 'Has attachments';
	const NO_SUBJECT = '(no subject)';
	const MESSAGES = (count: number) => `${count} messages`;
	const MORE = (count: number) => `+${count}`;

	interface Props {
		thread: ThreadSummary;
		/** Where the row leads (the thread, or the reading pane on wide screens). */
		href: string;
		/** The thread's labels, already resolved from `thread.labelIds`. */
		labels?: readonly Label[];
		density?: MailRowDensity;
		/** The signed-in address, shown as "me" in the sender line. */
		selfEmail?: string;
		/** Current time, for "today" vs. a date. */
		now?: number;
		/** The row open in the reading pane. */
		active?: boolean;
		/** Selected in multi-select mode (the avatar shows a check). */
		selected?: boolean;
		/** Makes the avatar a select toggle. */
		onselect?: () => void;
		/** Multi-select mode: tapping the row toggles it instead of opening it. */
		selecting?: boolean;
		/** A long press on the row, which starts multi-select. */
		onlongpress?: () => void;
		/** Makes the star a toggle button (with a burst when it turns on). */
		onstar?: () => void;
		/** Makes the important marker a toggle button. */
		onimportant?: () => void;
		/** Mailbox-specific sender and time, e.g. "To: Ada" in Sent (see rowText). */
		text?: RowText;
		/** AI badge slot, e.g. a category or priority explanation (M10). */
		ai?: Snippet;
	}

	let {
		thread,
		href,
		labels = [],
		density = 'default',
		selfEmail,
		now = Date.now(),
		active = false,
		selected = false,
		onselect,
		selecting = false,
		onlongpress,
		onstar,
		onimportant,
		text = {},
		ai
	}: Props = $props();

	const sender = $derived(text.sender ?? senderLine(thread.participants, selfEmail));
	const last = $derived(thread.participants.at(-1));
	const avatarName = $derived(last?.name || last?.email || sender);
	const when = $derived(
		text.when ?? { text: listTime(thread.lastMessageAt, now), datetime: thread.lastMessageAt }
	);
	const subject = $derived(thread.subject.trim() || NO_SUBJECT);
	// Compact rows fold attachments into a paperclip; the others preview them.
	const showFiles = $derived(density !== 'compact' && thread.attachments.length > 0);
	const files = $derived(thread.attachments.slice(0, MAX_ATTACHMENT_CHIPS));
	const moreFiles = $derived(thread.attachments.length - files.length);

	function onclick(event: MouseEvent): void {
		if (!selecting || !onselect) return;
		event.preventDefault();
		onselect();
	}
</script>

<div
	class={[
		'row',
		`row--${density}`,
		{ 'row--unread': thread.isUnread, 'row--active': active, 'row--selected': selected }
	]}
	use:longPress={() => onlongpress?.()}
>
	<Avatar
		name={avatarName}
		size={density === 'compact' ? 'sm' : 'md'}
		{selected}
		onclick={onselect}
		class="row__avatar"
	/>
	<!-- eslint-disable svelte/no-navigation-without-resolve -- the caller passes a resolve()d route. -->
	<a
		class="row__link"
		{href}
		aria-current={active ? 'page' : undefined}
		role={selecting ? 'button' : undefined}
		aria-pressed={selecting ? selected : undefined}
		{onclick}
	>
		<!-- eslint-enable svelte/no-navigation-without-resolve -->
		<span class="row__line">
			{#if thread.isUnread}<span class="nm-visually-hidden">{UNREAD},</span>{/if}
			<span class="row__sender nm-text-truncate">{sender}</span>
			{#if thread.messageCount > 1}
				<span class="row__count nm-text-numeric" aria-label={MESSAGES(thread.messageCount)}>
					{thread.messageCount}
				</span>
			{/if}
			{#if thread.isImportant && !onimportant}
				<Icon icon={Bookmark} size="sm" label={IMPORTANT} class="row__important" />
			{/if}
			<time class="row__time nm-text-numeric" datetime={when.datetime}>{when.text}</time>
		</span>
		<span class="row__line">
			<span class="row__subject nm-text-truncate">{subject}</span>
			{#if ai}<span class="row__ai">{@render ai()}</span>{/if}
			<span class="row__marks">
				{#if thread.attachments.length > 0 && !showFiles}
					<Icon icon={Paperclip} size="sm" label={HAS_ATTACHMENTS} />
				{/if}
				{#if thread.isStarred && !onstar}
					<Icon icon={Star} size="sm" label={STARRED} class="row__star" />
				{/if}
			</span>
		</span>
		<span class="row__snippet">{thread.snippet}</span>
		{#if labels.length > 0}
			<span class="row__chips">
				{#each labels as label (label.id)}
					<LabelPill name={label.name} color={label.color} />
				{/each}
			</span>
		{/if}
		{#if showFiles}
			<span class="row__chips">
				{#each files as file, index (index)}
					<span class="row__file">
						<Icon icon={file.mime.startsWith('image/') ? Image : FileText} size="sm" />
						<span class="nm-text-truncate">{file.filename}</span>
					</span>
				{/each}
				{#if moreFiles > 0}<span class="row__file">{MORE(moreFiles)}</span>{/if}
			</span>
		{/if}
	</a>
	{#if onstar || onimportant}
		<span class="row__toggles">
			{#if onstar}
				<MarkToggle
					icon={Star}
					label={STARRED}
					pressed={thread.isStarred}
					burst
					disabled={selecting}
					ontoggle={onstar}
				/>
			{/if}
			{#if onimportant}
				<MarkToggle
					icon={Bookmark}
					label={IMPORTANT}
					pressed={thread.isImportant}
					disabled={selecting}
					ontoggle={onimportant}
				/>
			{/if}
		</span>
	{/if}
</div>

<style>
	.row {
		display: flex;
		align-items: flex-start;
		gap: var(--nm-space-3);
		padding-block: var(--nm-space-3);
		padding-inline: var(--nm-space-4);
		border-radius: var(--nm-radius-lg);
		color: var(--nm-color-text-muted);
		transition: background-color var(--nm-duration-fast) var(--nm-ease-standard);
	}
	.row--compact {
		align-items: center;
		padding-block: var(--nm-space-2);
	}
	.row--comfortable {
		padding-block: var(--nm-space-4);
	}
	.row:hover {
		background: var(--nm-color-surface-1);
	}
	.row--active,
	.row--selected {
		background: var(--nm-color-selection);
	}
	.row :global(.row__avatar) {
		flex: none;
	}
	.row__link {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: var(--nm-space-1);
		min-inline-size: 0;
		border-radius: var(--nm-radius-sm);
		color: inherit;
		font-size: var(--nm-text-body);
		text-decoration: none;
		/* iOS would show its link preview on a long press, which selects instead. */
		-webkit-touch-callout: none;
	}
	.row__link:focus-visible {
		outline: 2px solid var(--nm-color-focus);
		outline-offset: var(--nm-space-1);
	}
	.row__line {
		display: flex;
		align-items: center;
		gap: var(--nm-space-2);
		min-inline-size: 0;
	}
	.row__sender,
	.row__subject {
		flex: 0 1 auto;
		color: var(--nm-color-text);
	}
	.row__count,
	.row__time {
		flex: none;
		font-size: var(--nm-text-caption);
	}
	.row__count {
		color: var(--nm-color-text-subtle);
	}
	.row__time {
		margin-inline-start: auto;
	}
	.row__ai {
		flex: none;
	}
	.row__marks {
		display: inline-flex;
		flex: none;
		gap: var(--nm-space-1);
		margin-inline-start: auto;
	}
	.row :global(.row__important),
	.row :global(.row__star) {
		flex: none;
		color: var(--nm-color-amber);
		fill: currentColor;
	}
	/* 44px targets that overlap the row padding instead of growing the row. */
	.row__toggles {
		display: flex;
		flex: none;
		flex-direction: column;
		margin-block: calc(-1 * var(--nm-space-3));
		margin-inline: calc(-1 * var(--nm-space-3)) calc(-1 * var(--nm-space-4));
	}
	.row--compact .row__toggles {
		flex-direction: row;
	}
	.row__snippet {
		display: -webkit-box;
		overflow: hidden;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 1;
		line-clamp: 1;
		color: var(--nm-color-text-subtle);
	}
	.row--comfortable .row__snippet {
		-webkit-line-clamp: 2;
		line-clamp: 2;
	}
	.row--compact .row__snippet {
		display: none;
	}
	/* Unread: bold text plus a dot, so it never relies on color alone. */
	.row--unread .row__sender,
	.row--unread .row__subject {
		font-weight: var(--nm-weight-bold);
	}
	.row--unread .row__time {
		color: var(--nm-color-accent-text);
		font-weight: var(--nm-weight-semibold);
	}
	.row--unread .row__sender::before {
		content: '';
		display: inline-block;
		inline-size: var(--nm-space-2);
		block-size: var(--nm-space-2);
		margin-inline-end: var(--nm-space-2);
		border-radius: var(--nm-radius-round);
		background: var(--nm-color-accent);
		vertical-align: middle;
	}
	.row__chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--nm-space-2);
		padding-block-start: var(--nm-space-1);
	}
	.row__file {
		display: inline-flex;
		align-items: center;
		gap: var(--nm-space-1);
		max-inline-size: 10rem;
		padding-block: var(--nm-space-1);
		padding-inline: var(--nm-space-3);
		border: 1px solid var(--nm-color-border);
		border-radius: var(--nm-radius-pill);
		font-size: var(--nm-text-caption);
	}
	@media (prefers-reduced-motion: reduce) {
		.row {
			transition: none;
		}
	}
</style>
