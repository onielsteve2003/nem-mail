<script lang="ts">
	import type { Snippet } from 'svelte';
	import StateIllustration, { type StateIllustrationName } from './StateIllustration.svelte';

	interface Props {
		title: string;
		message?: string;
		illustration?: StateIllustrationName;
		/** Optional call to action, e.g. a "Clear search" button. */
		action?: Snippet;
		class?: string;
	}

	let { title, message, illustration = 'inbox', action, class: className }: Props = $props();
</script>

<section class={['state', className]}>
	<StateIllustration name={illustration} />
	<h2 class="title">{title}</h2>
	{#if message}<p class="message">{message}</p>{/if}
	{#if action}<div class="action">{@render action()}</div>{/if}
</section>

<style>
	.state {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--nm-space-3);
		padding-block: var(--nm-space-8);
		padding-inline: var(--nm-space-6);
		text-align: center;
	}
	.title {
		margin: 0;
		color: var(--nm-color-text);
		font-family: var(--nm-font-display);
		font-size: var(--nm-text-title-3);
		font-weight: var(--nm-weight-semibold);
	}
	.message {
		max-inline-size: 22rem;
		margin: 0;
		color: var(--nm-color-text-muted);
		font-size: var(--nm-text-body);
		line-height: var(--nm-leading-normal);
	}
	.action {
		margin-block-start: var(--nm-space-2);
	}
</style>
