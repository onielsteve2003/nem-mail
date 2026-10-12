<script lang="ts">
	import X from '@lucide/svelte/icons/x';
	import type { AIInsight } from '@nem/shared';
	import type { Snippet } from 'svelte';
	import AIBadge from './AIBadge.svelte';
	import AIThinking from './AIThinking.svelte';
	import Button from './Button.svelte';
	import IconButton from './IconButton.svelte';

	const RETRY_TEXT = 'Try again';
	const DISMISS_TEXT = 'Dismiss';

	interface Props {
		title: string;
		/** Feeds the badge's "why" panel. */
		insight?: AIInsight<unknown>;
		/** Shown while the AI works, in place of the content. */
		isLoading?: boolean;
		loadingLabel?: string;
		/** A short failure message; shows Retry when `onretry` is given. */
		error?: string | null;
		onretry?: () => void;
		/** Shows a close button. */
		ondismiss?: () => void;
		/** Buttons or chips under the content, e.g. "Copy code". */
		actions?: Snippet;
		children?: Snippet;
		class?: string;
	}

	let {
		title,
		insight,
		isLoading = false,
		loadingLabel,
		error = null,
		onretry,
		ondismiss,
		actions,
		children,
		class: className
	}: Props = $props();

	const titleId = $props.id();
</script>

<!-- A card for one AI result (summary, extraction, nudge), with its loading and error states. -->
<section class={['ai-card', className]} aria-labelledby={titleId} aria-busy={isLoading}>
	<header class="ai-card__header">
		<AIBadge {insight} />
		<h3 id={titleId} class="ai-card__title">{title}</h3>
		{#if ondismiss}
			<IconButton icon={X} label={DISMISS_TEXT} variant="ghost" size="sm" onclick={ondismiss} />
		{/if}
	</header>
	{#if isLoading}
		<AIThinking label={loadingLabel} />
	{:else if error}
		<div class="ai-card__error" role="alert">
			<p>{error}</p>
			{#if onretry}
				<Button variant="ghost" size="sm" onclick={onretry}>{RETRY_TEXT}</Button>
			{/if}
		</div>
	{:else}
		<div class="ai-card__body">{@render children?.()}</div>
		{#if actions}
			<div class="ai-card__actions">{@render actions()}</div>
		{/if}
	{/if}
</section>

<style>
	.ai-card {
		position: relative;
		display: grid;
		gap: var(--nm-space-3);
		padding: var(--nm-space-4);
		border: 1px solid color-mix(in srgb, var(--nm-color-violet) 35%, var(--nm-color-border));
		border-radius: var(--nm-radius-lg);
		background:
			linear-gradient(
				135deg,
				color-mix(in srgb, var(--nm-color-violet) 10%, transparent),
				color-mix(in srgb, var(--nm-color-cyan) 6%, transparent)
			),
			var(--nm-color-surface-2);
		color: var(--nm-color-text);
	}
	.ai-card__header {
		display: flex;
		align-items: center;
		gap: var(--nm-space-2);
	}
	.ai-card__title {
		flex: 1;
		margin: 0;
		font-family: var(--nm-font-display);
		font-size: var(--nm-text-label);
		font-weight: var(--nm-weight-semibold);
	}
	.ai-card__body {
		font-size: var(--nm-text-body);
		line-height: var(--nm-leading-normal);
	}
	.ai-card__error {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--nm-space-2);
		color: var(--nm-color-danger);
		font-size: var(--nm-text-label);
	}
	.ai-card__error p {
		margin: 0;
	}
	.ai-card__actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--nm-space-2);
	}
</style>
