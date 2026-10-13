<script lang="ts">
	import type { SummaryVerdict } from '#lib/ai/models/textrank.js';
	import AICard from '#components/ui/AICard.svelte';

	const TITLE = 'Summary';
	const WORKING = 'Summarizing this conversation';
	const FAILED = "Couldn't summarize this conversation.";
	const ACTION_ITEMS = 'Action items';

	interface Props {
		verdict: SummaryVerdict | null;
		isLoading?: boolean;
		error?: boolean;
		onretry?: () => void;
		ondismiss?: () => void;
	}

	let { verdict, isLoading = false, error = false, onretry, ondismiss }: Props = $props();

	const listId = $props.id();
</script>

<!-- AI-3: the thread in two sentences, plus what it asks of the reader. -->
<AICard
	class="summary-card"
	title={TITLE}
	insight={verdict ?? undefined}
	{isLoading}
	loadingLabel={WORKING}
	error={error ? FAILED : null}
	{onretry}
	{ondismiss}
>
	{#if verdict}
		<p class="summary-card__text" aria-live="polite">{verdict.value.text}</p>
		{#if verdict.value.actionItems.length > 0}
			<h4 id={listId} class="summary-card__heading nm-text-label">{ACTION_ITEMS}</h4>
			<ul class="summary-card__items" aria-labelledby={listId}>
				{#each verdict.value.actionItems as item (item)}
					<li>{item}</li>
				{/each}
			</ul>
		{/if}
	{/if}
</AICard>

<style>
	:global(.summary-card) {
		margin-inline: var(--nm-space-4);
		margin-block-end: var(--nm-space-3);
	}
	.summary-card__text {
		margin: 0;
	}
	.summary-card__heading {
		margin-block: var(--nm-space-3) var(--nm-space-1);
		color: var(--nm-color-text-muted);
	}
	.summary-card__items {
		display: grid;
		gap: var(--nm-space-1);
		margin: 0;
		padding-inline-start: var(--nm-space-5);
	}
</style>
