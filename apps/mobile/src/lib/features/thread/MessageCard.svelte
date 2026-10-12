<script lang="ts">
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import type { Address, ComposeMode, Message } from '@nem/shared';
	import Avatar from '#components/ui/Avatar.svelte';
	import Icon from '#components/ui/Icon.svelte';
	import AttachmentList from './AttachmentList.svelte';
	import EmailBody from './EmailBody.svelte';
	import MessageActions from './MessageActions.svelte';
	import { addressName, fullTime, messageTime, recipientLine } from './messages.js';

	const UNREAD = 'Unread';
	const DETAILS = 'Show details';
	const HIDE_DETAILS = 'Hide details';

	interface Props {
		message: Message;
		expanded: boolean;
		ontoggle: () => void;
		/** The user's address, shown as "me". */
		selfEmail?: string;
		/** Reference time for the card's date; tests pin it. */
		now?: number;
		/** Fetches an attachment's bytes for thumbnails and downloads. */
		loadAttachment?: (id: string) => Promise<Blob>;
		/** Reply, reply all and forward; the buttons show only when it is set. */
		oncompose?: (mode: Exclude<ComposeMode, 'new'>, message: Message) => void;
	}

	let {
		message,
		expanded,
		ontoggle,
		selfEmail,
		now = Date.now(),
		loadAttachment,
		oncompose
	}: Props = $props();

	let showDetails = $state(false);

	const sender = $derived(addressName(message.from, selfEmail));
	const when = $derived(messageTime(message.sentAt, now));
	const detailsId = $derived(`message-details-${message.id}`);
	const details = $derived(
		(
			[
				['From', [message.from]],
				['To', message.to],
				['Cc', message.cc],
				['Bcc', message.bcc]
			] satisfies [string, Address[]][]
		).filter(([, list]) => list.length > 0)
	);

	function formatAddress(address: Address): string {
		return address.name ? `${address.name} <${address.email}>` : address.email;
	}
</script>

<article class={['card', { 'card--expanded': expanded, 'card--unread': !message.isRead }]}>
	<button type="button" class="card__head" aria-expanded={expanded} onclick={ontoggle}>
		<Avatar name={message.from.name || message.from.email} size="md" />
		<span class="card__who">
			<span class="card__line">
				<span class="card__sender nm-text-truncate">{sender}</span>
				{#if !message.isRead}<span class="nm-visually-hidden">{UNREAD}</span>{/if}
				<time class="card__time nm-text-caption" datetime={message.sentAt}>{when}</time>
			</span>
			{#if !expanded}
				<span class="card__snippet nm-text-caption nm-text-truncate">{message.snippet}</span>
			{/if}
		</span>
	</button>

	{#if expanded}
		<button
			type="button"
			class="card__recipients nm-text-caption"
			aria-expanded={showDetails}
			aria-controls={detailsId}
			onclick={() => (showDetails = !showDetails)}
		>
			<span class="nm-text-truncate">{recipientLine(message, selfEmail)}</span>
			<Icon icon={ChevronDown} size="sm" label={showDetails ? HIDE_DETAILS : DETAILS} />
		</button>
		{#if showDetails}
			<dl id={detailsId} class="card__details nm-text-caption">
				{#each details as [term, list] (term)}
					<dt>{term}</dt>
					<dd>{list.map(formatAddress).join(', ')}</dd>
				{/each}
				<dt>Date</dt>
				<dd>{fullTime(message.sentAt)}</dd>
			</dl>
		{/if}
		<div class="card__body nm-text-body">
			<EmailBody html={message.bodyHtml} text={message.bodyText} />
		</div>
		{#if loadAttachment && message.attachments.length > 0}
			<AttachmentList attachments={message.attachments} load={loadAttachment} />
		{/if}
		{#if oncompose}
			<MessageActions {message} {selfEmail} {oncompose} />
		{/if}
	{/if}
</article>

<style>
	.card {
		display: flex;
		flex-direction: column;
		border-block-end: 1px solid var(--nm-color-border);
	}
	.card__head {
		display: flex;
		align-items: center;
		gap: var(--nm-space-3);
		min-block-size: var(--nm-size-touch);
		padding: var(--nm-space-3) var(--nm-space-4);
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		text-align: start;
		cursor: pointer;
	}
	.card__head:hover {
		background: var(--nm-color-surface-2);
	}
	.card__who {
		display: flex;
		flex: 1;
		flex-direction: column;
		min-inline-size: 0;
	}
	.card__line {
		display: flex;
		align-items: baseline;
		gap: var(--nm-space-2);
	}
	.card__sender {
		flex: 1;
		color: var(--nm-color-text);
		font-weight: var(--nm-weight-medium);
	}
	.card--unread .card__sender {
		font-weight: var(--nm-weight-bold);
	}
	.card__time,
	.card__snippet {
		color: var(--nm-color-text-muted);
	}
	.card__time {
		flex: none;
	}
	.card__recipients {
		display: flex;
		align-items: center;
		gap: var(--nm-space-1);
		align-self: flex-start;
		max-inline-size: 100%;
		min-block-size: var(--nm-size-touch);
		margin-block-start: calc(-1 * var(--nm-space-3));
		padding-inline: calc(var(--nm-space-4) + var(--nm-size-avatar-md) + var(--nm-space-3))
			var(--nm-space-4);
		border: 0;
		background: none;
		color: var(--nm-color-text-muted);
		font: inherit;
		cursor: pointer;
	}
	.card__recipients[aria-expanded='true'] :global(svg) {
		transform: rotate(180deg);
	}
	.card__details {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: var(--nm-space-1) var(--nm-space-3);
		margin: 0 var(--nm-space-4) var(--nm-space-3);
		padding: var(--nm-space-3);
		border-radius: var(--nm-radius-md);
		background: var(--nm-color-surface-2);
		color: var(--nm-color-text-muted);
	}
	.card__details dt {
		color: var(--nm-color-text-subtle);
	}
	.card__details dd {
		margin: 0;
		overflow-wrap: anywhere;
	}
	.card__body {
		padding: var(--nm-space-2) var(--nm-space-4) var(--nm-space-5);
	}
</style>
