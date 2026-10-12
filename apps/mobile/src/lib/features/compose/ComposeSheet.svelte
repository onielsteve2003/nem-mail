<script lang="ts">
	import { morph } from '#lib/motion/index.js';
	import { COMPOSE_SHEET, getUiStore } from '#lib/stores/ui.svelte.js';
	import { overlay } from '#lib/utils/overlay.js';
	import ComposeForm from './ComposeForm.svelte';

	const ui = getUiStore();
	const id = $props.id();

	const isOpen = $derived(ui.isSheetOpen(COMPOSE_SHEET));
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
			<ComposeForm
				request={ui.composeRequest}
				titleId="{id}-title"
				onclose={() => ui.closeCompose()}
			/>
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
