<script lang="ts">
	import Send from '@lucide/svelte/icons/send';
	import X from '@lucide/svelte/icons/x';
	import Button from '#components/ui/Button.svelte';
	import Icon from '#components/ui/Icon.svelte';
	import IconButton from '#components/ui/IconButton.svelte';
	import { morph } from '#lib/motion/index.js';
	import { COMPOSE_SHEET, getUiStore } from '#lib/stores/ui.svelte.js';
	import { overlay } from '#lib/utils/overlay.js';
	import { composeTitle } from './compose.js';

	const CLOSE = 'Close compose';
	const SEND = 'Send';

	const ui = getUiStore();
	const id = $props.id();

	const isOpen = $derived(ui.isSheetOpen(COMPOSE_SHEET));
	const title = $derived(composeTitle(ui.composeRequest));
	// Kept for the exit, so compose shrinks back into the button it came from.
	const origin = $derived(ui.composeOrigin);
</script>

{#if isOpen}
	<div class="layer">
		<!-- Full screen on phones covers the page; docked on wide screens the list stays usable. -->
		<div
			class="compose"
			role="dialog"
			aria-modal="true"
			aria-labelledby="{id}-title"
			tabindex="-1"
			transition:morph={{ origin }}
			use:overlay={{ onescape: () => ui.closeCompose() }}
		>
			<header class="compose__head">
				<IconButton icon={X} label={CLOSE} onclick={() => ui.closeCompose()} />
				<h2 id="{id}-title" class="compose__title nm-text-title-3">{title}</h2>
				<!-- Enabled once there is a recipient (T7.2) and sending exists (T7.7). -->
				<Button size="sm" disabled>
					{#snippet leading()}<Icon icon={Send} size="sm" />{/snippet}
					{SEND}
				</Button>
			</header>
			<div class="compose__body"></div>
		</div>
	</div>
{/if}

<style>
	.layer {
		position: fixed;
		inset: 0;
		z-index: var(--nm-z-sheet);
		pointer-events: none;
	}
	.compose {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		padding-block: var(--nm-safe-top) var(--nm-safe-bottom);
		padding-inline: var(--nm-safe-left) var(--nm-safe-right);
		background: var(--nm-color-surface-2);
		color: var(--nm-color-text);
		outline: none;
		pointer-events: auto;
	}
	.compose__head {
		display: flex;
		align-items: center;
		gap: var(--nm-space-2);
		padding: var(--nm-space-2) var(--nm-space-3);
		border-block-end: 1px solid var(--nm-color-border);
	}
	.compose__title {
		flex: 1;
		margin: 0;
		min-inline-size: 0;
	}
	.compose__body {
		flex: 1;
		min-block-size: 0;
		overflow-y: auto;
	}
	/* Docked at the bottom right on wide screens, like a desktop mail client. */
	@media (min-width: 900px) {
		.compose {
			inset: auto;
			inset-block-end: 0;
			inset-inline-end: calc(var(--nm-safe-right) + var(--nm-space-6));
			inline-size: min(36rem, calc(100vw - 2 * var(--nm-space-6)));
			block-size: min(40rem, calc(var(--nm-viewport-height) - var(--nm-space-10)));
			padding: 0;
			border: 1px solid var(--nm-color-border-strong);
			border-block-end: none;
			border-start-start-radius: var(--nm-radius-xl);
			border-start-end-radius: var(--nm-radius-xl);
			box-shadow: var(--nm-shadow-4);
		}
	}
</style>
