<script lang="ts">
	import X from '@lucide/svelte/icons/x';
	import type { Snippet } from 'svelte';
	import { fadeScale } from '#lib/motion/index.js';
	import { overlay } from '#lib/utils/overlay.js';
	import IconButton from './IconButton.svelte';

	const CLOSE_LABEL = 'Close';

	interface Props {
		open?: boolean;
		title: string;
		/** Supporting text under the title; also becomes the dialog description. */
		description?: string;
		/** alertdialog for confirmations that interrupt the user. */
		role?: 'dialog' | 'alertdialog';
		/** Shows the X button in the corner. */
		showClose?: boolean;
		/** When false, the scrim and Escape do nothing; the user must pick an action. */
		dismissible?: boolean;
		onclose?: () => void;
		children?: Snippet;
		/** Footer buttons, laid out end-aligned. */
		actions?: Snippet;
		class?: string;
	}

	let {
		open = $bindable(false),
		title,
		description,
		role = 'dialog',
		showClose = true,
		dismissible = true,
		onclose,
		children,
		actions,
		class: className
	}: Props = $props();

	const id = $props.id();

	function close() {
		if (!open) return;
		open = false;
		onclose?.();
	}

	function dismiss() {
		if (dismissible) close();
	}
</script>

{#if open}
	<div class="layer">
		<!-- Tapping the scrim dismisses; keyboard users press Escape. -->
		<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
		<div class="scrim" transition:fadeScale={{ start: 1 }} onclick={dismiss}></div>
		<div
			class={['modal', className]}
			{role}
			aria-modal="true"
			aria-labelledby="{id}-title"
			aria-describedby={description ? `${id}-desc` : undefined}
			tabindex="-1"
			transition:fadeScale
			use:overlay={{ onescape: dismissible ? close : undefined }}
		>
			<div class="head">
				<h2 id="{id}-title" class="title">{title}</h2>
				{#if showClose}
					<IconButton icon={X} label={CLOSE_LABEL} size="sm" onclick={close} />
				{/if}
			</div>
			{#if description}
				<p id="{id}-desc" class="description">{description}</p>
			{/if}
			{#if children}
				<div class="body">{@render children()}</div>
			{/if}
			{#if actions}
				<div class="actions">{@render actions()}</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.layer {
		position: fixed;
		inset: 0;
		z-index: var(--nm-z-modal);
		display: grid;
		place-items: center;
		padding-block: calc(var(--nm-safe-top) + var(--nm-space-5))
			calc(var(--nm-safe-bottom) + var(--nm-space-5));
		padding-inline: calc(var(--nm-safe-left) + var(--nm-space-5))
			calc(var(--nm-safe-right) + var(--nm-space-5));
	}
	.scrim {
		position: absolute;
		inset: 0;
		background: var(--nm-color-scrim);
	}
	.modal {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: var(--nm-space-3);
		inline-size: min(100%, 28rem);
		max-block-size: 100%;
		padding: var(--nm-space-6);
		border: 1px solid var(--nm-color-border-strong);
		border-radius: var(--nm-radius-xl);
		background: var(--nm-color-surface-3);
		box-shadow: var(--nm-shadow-4);
		color: var(--nm-color-text);
		outline: none;
	}
	.head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--nm-space-3);
	}
	.title {
		margin: 0;
		font-family: var(--nm-font-display);
		font-size: var(--nm-text-title-3);
		font-weight: var(--nm-weight-semibold);
	}
	.description {
		margin: 0;
		color: var(--nm-color-text-muted);
		font-size: var(--nm-text-body);
		line-height: var(--nm-leading-normal);
	}
	.body {
		min-block-size: 0;
		overflow-y: auto;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: var(--nm-space-2);
		margin-block-start: var(--nm-space-2);
	}
</style>
