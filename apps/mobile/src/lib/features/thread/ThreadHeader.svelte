<script lang="ts">
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import Bookmark from '@lucide/svelte/icons/bookmark';
	import X from '@lucide/svelte/icons/x';
	import type { AIInsight, Label } from '@nem/shared';
	import type { Snippet } from 'svelte';
	import AIBadge from '#components/ui/AIBadge.svelte';
	import Icon from '#components/ui/Icon.svelte';
	import IconButton from '#components/ui/IconButton.svelte';
	import LabelPill from '#components/ui/LabelPill.svelte';

	const BACK = 'Back';
	const CLOSE = 'Close conversation';
	const IMPORTANT = 'Important';
	const LABELS = 'Labels';
	const NO_SUBJECT = '(no subject)';

	interface Props {
		/** Null while the thread loads: the toolbar shows, the subject does not. */
		subject: string | null;
		labels?: Label[];
		isImportant?: boolean;
		/** Why the priority model rates the thread important (AI-6); shows an AI badge. */
		importance?: AIInsight<number> | null;
		/** Back arrow on the full-screen route, X in the reading pane. */
		variant?: 'back' | 'close';
		onclose: () => void;
		/** Thread actions on the right of the toolbar (T6.5). */
		actions?: Snippet;
	}

	let {
		subject,
		labels = [],
		isImportant = false,
		importance = null,
		variant = 'back',
		onclose,
		actions
	}: Props = $props();
</script>

<header class="header">
	<div class="header__toolbar">
		<IconButton
			icon={variant === 'back' ? ArrowLeft : X}
			label={variant === 'back' ? BACK : CLOSE}
			onclick={onclose}
		/>
		{#if actions}<div class="header__actions">{@render actions()}</div>{/if}
	</div>
	{#if subject !== null}
		<h1 class="header__subject nm-text-title-2">
			{subject || NO_SUBJECT}
			{#if isImportant}
				<Icon icon={Bookmark} size="md" label={IMPORTANT} class="header__important" />
				{#if importance}<AIBadge insight={importance} class="header__why" />{/if}
			{/if}
		</h1>
	{/if}
	{#if labels.length > 0}
		<ul class="header__labels" aria-label={LABELS}>
			{#each labels as label (label.id)}
				<li><LabelPill name={label.name} color={label.color} /></li>
			{/each}
		</ul>
	{/if}
</header>

<style>
	.header {
		display: flex;
		flex-direction: column;
		gap: var(--nm-space-2);
		padding-inline: var(--nm-space-2) var(--nm-space-4);
		padding-block-end: var(--nm-space-3);
	}
	.header__toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--nm-space-2);
	}
	.header__actions {
		display: flex;
		gap: var(--nm-space-1);
	}
	.header__subject {
		margin: 0;
		padding-inline-start: var(--nm-space-2);
		color: var(--nm-color-text);
		overflow-wrap: anywhere;
	}
	.header :global(.header__important) {
		vertical-align: middle;
		color: var(--nm-color-amber);
		fill: currentColor;
	}
	.header :global(.header__why) {
		vertical-align: middle;
	}
	.header__labels {
		display: flex;
		flex-wrap: wrap;
		gap: var(--nm-space-2);
		margin: 0;
		padding: 0;
		padding-inline-start: var(--nm-space-2);
		list-style: none;
	}
</style>
