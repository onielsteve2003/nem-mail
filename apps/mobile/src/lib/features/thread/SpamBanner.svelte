<script lang="ts">
	import type { AIInsight } from '@nem/shared';
	import AICard from '#components/ui/AICard.svelte';
	import Button from '#components/ui/Button.svelte';

	const TITLE = 'Why this is in Spam';
	const PHISHING_TITLE = 'Possible phishing';
	const CHECKING = 'Checking this message';
	const FAILED = "Couldn't check this message.";
	const NOT_FLAGGED = "You moved this to Spam. Nem's filter didn't flag it:";
	const NOT_SPAM = 'Not spam';

	interface Props {
		verdict: AIInsight<{ isSpam: boolean; isPhishing: boolean }> | null;
		isLoading?: boolean;
		error?: string | null;
		onretry?: () => void;
		onnotspam: () => void;
	}

	let { verdict, isLoading = false, error = null, onretry, onnotspam }: Props = $props();
</script>

<AICard
	class="spam-banner"
	title={verdict?.value.isPhishing ? PHISHING_TITLE : TITLE}
	insight={verdict ?? undefined}
	{isLoading}
	loadingLabel={CHECKING}
	error={error ? FAILED : null}
	{onretry}
>
	{#if verdict}
		<p class="spam-banner__text">
			{#if !verdict.value.isSpam}{NOT_FLAGGED}{/if}
			{verdict.explanation}
		</p>
	{/if}
	{#snippet actions()}
		<Button variant="glass" size="sm" onclick={onnotspam}>{NOT_SPAM}</Button>
	{/snippet}
</AICard>

<style>
	:global(.spam-banner) {
		margin-inline: var(--nm-space-4);
		margin-block-end: var(--nm-space-3);
	}
	.spam-banner__text {
		margin: 0;
	}
</style>
