<script lang="ts">
	import type { Message } from '@nem/shared';
	import { untrack } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import MessageCard from './MessageCard.svelte';
	import { initialExpanded, messageLayout } from './messages.js';

	const EARLIER = (count: number) => `${count} earlier message${count === 1 ? '' : 's'}`;

	interface Props {
		messages: Message[];
		selfEmail?: string;
	}

	let { messages, selfEmail }: Props = $props();

	// Which messages start open is decided once per thread (the parent keys this list).
	const expanded = new SvelteSet(untrack(() => initialExpanded(messages)));
	let showAll = $state(false);

	const items = $derived(messageLayout(messages, showAll));

	function toggle(id: string): void {
		if (expanded.has(id)) expanded.delete(id);
		else expanded.add(id);
	}
</script>

<ol class="messages">
	{#each items as item (item.kind === 'group' ? 'group' : item.message.id)}
		<li>
			{#if item.kind === 'group'}
				<button type="button" class="messages__group" onclick={() => (showAll = true)}>
					<span class="messages__count nm-text-label">{EARLIER(item.count)}</span>
				</button>
			{:else}
				<MessageCard
					message={item.message}
					expanded={expanded.has(item.message.id)}
					ontoggle={() => toggle(item.message.id)}
					{selfEmail}
				/>
			{/if}
		</li>
	{/each}
</ol>

<style>
	.messages {
		margin: 0;
		padding: 0;
		list-style: none;
		border-block-start: 1px solid var(--nm-color-border);
	}
	.messages__group {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		inline-size: 100%;
		min-block-size: var(--nm-size-touch);
		border: 0;
		border-block-end: 1px solid var(--nm-color-border);
		background: none;
		color: inherit;
		font: inherit;
		cursor: pointer;
	}
	/* Two rules suggest the stacked messages behind the count. */
	.messages__group::before,
	.messages__group::after {
		content: '';
		position: absolute;
		inset-inline: 0;
		border-block-start: 1px solid var(--nm-color-border);
	}
	.messages__group::before {
		inset-block-start: 40%;
	}
	.messages__group::after {
		inset-block-start: 60%;
	}
	.messages__count {
		position: relative;
		z-index: var(--nm-z-raised);
		padding: var(--nm-space-1) var(--nm-space-3);
		border: 1px solid var(--nm-color-border-strong);
		border-radius: var(--nm-radius-pill);
		background: var(--nm-color-surface-1);
		color: var(--nm-color-accent-text);
	}
	.messages__group:hover .messages__count {
		background: var(--nm-color-surface-2);
	}
</style>
