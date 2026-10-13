<script lang="ts">
	import AIBadge from '#components/ui/AIBadge.svelte';
	import BottomSheet from '#components/ui/BottomSheet.svelte';
	import Button from '#components/ui/Button.svelte';
	import type { ToneVerdict } from '#lib/ai/models/tone.js';

	const COPY = {
		title: 'This may sound harsh',
		lead: 'Your message could come across as harsher than you mean it.',
		signs: 'What stood out',
		tip: 'Softening a word or two, or adding a thank you, often helps.',
		edit: 'Edit message',
		sendAnyway: 'Send anyway'
	};

	interface Props {
		open?: boolean;
		verdict: ToneVerdict | null;
		/** Back to the message, compose stays open. */
		onedit: () => void;
		onsend: () => void;
	}

	let { open = $bindable(false), verdict, onedit, onsend }: Props = $props();

	function edit() {
		open = false;
		onedit();
	}

	function send() {
		open = false;
		onsend();
	}
</script>

<BottomSheet bind:open title={COPY.title} onclose={onedit}>
	<div class="tone">
		{#if verdict}
			<AIBadge insight={verdict} />
		{/if}
		<p class="tone__lead nm-text-body">{COPY.lead}</p>
		{#if verdict?.value.reasons.length}
			<h3 class="tone__heading nm-text-label">{COPY.signs}</h3>
			<ul class="tone__signs">
				{#each verdict.value.reasons as reason (reason)}
					<li class="tone__sign nm-text-label">{reason}</li>
				{/each}
			</ul>
		{/if}
		<p class="tone__tip nm-text-caption">{COPY.tip}</p>
		<div class="tone__actions">
			<Button variant="ghost" onclick={send}>{COPY.sendAnyway}</Button>
			<Button onclick={edit}>{COPY.edit}</Button>
		</div>
	</div>
</BottomSheet>

<style>
	.tone {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--nm-space-3);
		padding: var(--nm-space-2) var(--nm-space-4) var(--nm-space-4);
	}
	.tone__lead,
	.tone__tip {
		margin: 0;
	}
	.tone__tip {
		color: var(--nm-color-text-muted);
	}
	.tone__heading {
		margin: 0;
		color: var(--nm-color-text-muted);
	}
	.tone__signs {
		display: flex;
		flex-wrap: wrap;
		gap: var(--nm-space-2);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.tone__sign {
		padding: var(--nm-space-1) var(--nm-space-3);
		border: 1px solid var(--nm-color-border-strong);
		border-radius: var(--nm-radius-pill);
		color: var(--nm-color-text);
	}
	.tone__actions {
		display: flex;
		justify-content: flex-end;
		gap: var(--nm-space-2);
		align-self: stretch;
	}
</style>
